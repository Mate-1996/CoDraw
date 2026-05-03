import { AfterViewInit, Component, computed, DestroyRef, ElementRef, effect, inject, OnDestroy, signal, ViewChild,} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router} from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs/operators';

import { AuthService } from '../../core/auth.service';
import { DrawingService } from '../../core/drawing.service';
import { CommentService } from '../../core/comment.service';
import { RealtimeService } from '../../core/realtime.service';
import { Comment, Drawing, Stroke } from '../../core/models';
type Tool = 'pen' | 'eraser';

interface ActiveStroke {
  tempId: string;
  tool: Tool;
  color: string;
  size: number;
  points: { x: number; y: number }[];
  userId: string;
}

interface RemoteCursorState {
  userId: string;
  x: number;
  y: number;
}

@Component({
  selector: 'app-drawing-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DatePipe],
  templateUrl: './drawing-page.component.html',
  styleUrl: './drawing-page.component.css',
})
export class DrawingPageComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('cursorCanvas') cursorCanvasRef!: ElementRef<HTMLCanvasElement>;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly drawingService = inject(DrawingService);
  private readonly commentService = inject(CommentService);
  private readonly realtimeService = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);

  private ctx!: CanvasRenderingContext2D;
  private cursorCtx!: CanvasRenderingContext2D;
  private isPointerDown = false;
  private currentStroke: ActiveStroke | null = null;
  private remoteStrokes = new Map<string, ActiveStroke>();
  private remoteCursors = new Map<string, RemoteCursorState>();
  private lastCursorEmit = 0;
  private cursorAnimFrame = 0;

  readonly currentUser = computed(() => this.authService.currentUser());
  readonly drawing = signal<Drawing | null>(null);
  readonly comments = signal<Comment[]>([]);
  readonly isLoading = signal(true);
  readonly pageError = signal('');
  readonly isSavingComment = signal(false);


  readonly activeTool = signal<Tool>('pen');
  readonly activeColor = signal('#1a1a2e');
  readonly brushSize = signal(4);

  readonly showComments = signal(false);
  readonly showInvite = signal(false);
  readonly showInfo = signal(false);
  readonly editingCommentId = signal<string | null>(null);

  readonly commentForm = this.fb.nonNullable.group({
    text: ['', [Validators.required, Validators.minLength(1)]],
  });

  readonly inviteForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  readonly onlineUsers = this.realtimeService.onlineUsers;

  readonly COLORS = [
    '#1a1a2e', '#e8431a', '#2563eb', '#16a34a',
    '#d97706', '#7c3aed', '#db2777', '#ffffff',
  ];

constructor() {
  effect(() => {
    const loading = this.isLoading();
    const drawing = this.drawing();

    if (!loading && drawing && !this.canvasInitialized) {
      setTimeout(() => {
        const id = this.route.snapshot.paramMap.get('id')!;
        this.initCanvas(id);
      }, 50);
    }
  });
} 

  ngAfterViewInit(): void {
  const drawingId = this.route.snapshot.paramMap.get('id')!;
  this.loadDrawing(drawingId);
}

  ngOnDestroy(): void {
    const drawingId = this.drawing()?._id;
    if (drawingId) this.realtimeService.leaveDrawing(drawingId);
    cancelAnimationFrame(this.cursorAnimFrame);
    window.removeEventListener('resize', () => this.resizeCanvas());
  }

  private loadDrawing(id: string): void {
  this.isLoading.set(true);
  this.drawingService.getDrawing(id)
    .pipe(finalize(() => {
      this.isLoading.set(false);
    }))
    .subscribe({
      next: (r) => {
        this.drawing.set(r.data.drawing);
      },
      error: (e) => this.pageError.set(e.error?.message ?? 'Could not load drawing.'),
    });
}

private canvasInitialized = false;

private initCanvas(id: string): void {
  if (this.canvasInitialized) return;
  if (!this.canvasRef || !this.cursorCanvasRef) return;

  const canvas = this.canvasRef.nativeElement;
  const cursorCanvas = this.cursorCanvasRef.nativeElement;

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight - 56;
  cursorCanvas.width = canvas.width;
  cursorCanvas.height = canvas.height;

  this.ctx = canvas.getContext('2d')!;
  this.cursorCtx = cursorCanvas.getContext('2d')!;


  this.canvasInitialized = true;

  console.log('Canvas initialized:', canvas.width, canvas.height);

  this.ctx.fillStyle = '#ffffff';
  this.ctx.fillRect(0, 0, canvas.width, canvas.height);

  window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight - 56;
    cursorCanvas.width = canvas.width;
    cursorCanvas.height = canvas.height;
    this.redrawCanvas();
  });

  const drawing = this.drawing();
  if (drawing) {
    this.renderAllStrokes(drawing.strokes);
    this.connectRealtime(id);
    this.loadComments(id);
  }
}

private realtimeConnected = false;

private connectRealtime(drawingId: string): void {
    if (this.realtimeConnected) return;
    this.realtimeConnected = true;

  const token = this.authService.token()!;
  this.realtimeService.connect(token);
  this.realtimeService.joinDrawing(drawingId);

    this.realtimeService.strokeStart$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ stroke }) => {
      const active: ActiveStroke = { ...stroke, tempId: stroke.tempId, points: stroke.points || [] };
      this.remoteStrokes.set(stroke.tempId, active);
    });

    this.realtimeService.strokePoint$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ strokeId, point }) => {
      const stroke = this.remoteStrokes.get(strokeId);
      if (!stroke) return;
      stroke.points.push(point);
      this.redrawCanvas();
    });

    this.realtimeService.strokeEnd$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ stroke }) => {
      this.remoteStrokes.clear();
      this.drawing.update((d) => d ? { ...d, strokes: [...(d.strokes || []), stroke] } : d);
      this.redrawCanvas();
    });

    this.realtimeService.cursorMove$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((cursor) => {
      this.remoteCursors.set(cursor.userId, cursor);
      this.drawCursors();
    });

    this.realtimeService.cursorLeave$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ userId }) => {
      this.remoteCursors.delete(userId);
      this.drawCursors();
    });

    this.realtimeService.commentAdded$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ comment }) => {
      const c = comment as Comment;
      const isMyComment = c.userId._id === this.currentUser()?.id;
      const exists = this.comments().some((x) => x._id === c._id);
      if (!exists && !isMyComment) {
        this.comments.update((list) => [...list, c]);
      }
    });
  }

  private loadComments(drawingId: string): void {
    this.commentService.getComments(drawingId).subscribe({
      next: (r) => this.comments.set(r.data.comments),
      error: () => {},
    });
  }



private resizeCanvas(): void {
  if (!this.ctx) return;
  this.redrawCanvas();
}

  private renderAllStrokes(strokes: Stroke[]): void {
    if (!strokes) return;
    strokes.forEach((s) => this.drawStroke(this.ctx, s));
  }

  private redrawCanvas(): void {
  if (!this.ctx) return;
  const canvas = this.canvasRef.nativeElement;
  

  this.ctx.fillStyle = '#ffffff';
  this.ctx.fillRect(0, 0, canvas.width, canvas.height);

  const d = this.drawing();
  if (d?.strokes) this.renderAllStrokes(d.strokes);
  this.remoteStrokes.forEach((s) => this.drawStroke(this.ctx, s));
  if (this.currentStroke) this.drawStroke(this.ctx, this.currentStroke);
  this.drawCursors();
}

  private drawStroke(ctx: CanvasRenderingContext2D, stroke: ActiveStroke | Stroke): void {
  const points = stroke.points;
  if (!points || points.length < 1) return;

  ctx.save();
  ctx.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';
  ctx.strokeStyle = stroke.color || '#000000';
  ctx.fillStyle = stroke.color || '#000000';
  ctx.lineWidth = stroke.size || 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';


  if (points.length === 1) {
    ctx.beginPath();
    ctx.arc(points[0].x, points[0].y, (stroke.size || 4) / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const mx = (prev.x + curr.x) / 2;
    const my = (prev.y + curr.y) / 2;
    ctx.quadraticCurveTo(prev.x, prev.y, mx, my);
  }
  ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
  ctx.stroke();
  ctx.restore();
}

  private drawCursors(): void {
    const canvas = this.cursorCanvasRef.nativeElement;
    this.cursorCtx.clearRect(0, 0, canvas.width, canvas.height);
    this.remoteCursors.forEach((cursor) => {
      this.cursorCtx.save();
      this.cursorCtx.fillStyle = '#e8431a';
      this.cursorCtx.beginPath();
      this.cursorCtx.arc(cursor.x, cursor.y, 6, 0, Math.PI * 2);
      this.cursorCtx.fill();
      this.cursorCtx.fillStyle = 'rgba(13,13,13,0.75)';
      this.cursorCtx.font = '12px DM Sans, sans-serif';
      this.cursorCtx.fillText(cursor.userId.slice(-4), cursor.x + 10, cursor.y - 6);
      this.cursorCtx.restore();
    });
  }



  private getPos(e: PointerEvent): { x: number; y: number } {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  onPointerDown(e: PointerEvent): void {
  this.isPointerDown = true;
  const pos = this.getPos(e);
  const tempId = `${Date.now()}-${Math.random()}`;
  this.currentStroke = {
    tempId,
    tool: this.activeTool(),
    color: this.activeColor(),
    size: this.brushSize(),
    points: [pos],
    userId: this.currentUser()?.id ?? '',
  };

  const drawingId = this.drawing()?._id;
  if (drawingId) this.realtimeService.emitStrokeStart(drawingId, this.currentStroke);
  this.canvasRef.nativeElement.setPointerCapture(e.pointerId);

}

  onPointerMove(e: PointerEvent): void {
  const drawingId = this.drawing()?._id;
  const pos = this.getPos(e);

  const now = Date.now();
  if (drawingId && now - this.lastCursorEmit > 30) {
    this.realtimeService.emitCursorMove(drawingId, pos.x, pos.y);
    this.lastCursorEmit = now;
  }

  if (!this.isPointerDown || !this.currentStroke) return;
  this.currentStroke.points.push(pos);
  this.redrawCanvas();
  
  if (drawingId) {
    this.realtimeService.emitStrokePoint(drawingId, this.currentStroke.tempId, pos);
  }
}

  onPointerUp(): void {
  if (!this.isPointerDown || !this.currentStroke) return;
  this.isPointerDown = false;

  const stroke = { ...this.currentStroke } as unknown as Stroke;
  const drawingId = this.drawing()?._id;

  if (drawingId) this.realtimeService.emitStrokeEnd(drawingId, stroke);


  this.drawing.update((d) => {
    if (!d) return d;
    return { ...d, strokes: [...(d.strokes || []), stroke] };
  });

  this.currentStroke = null;
  this.redrawCanvas();
}

  onPointerLeave(): void {
    const drawingId = this.drawing()?._id;
    if (drawingId) this.realtimeService.emitCursorLeave(drawingId);
  }


  selectTool(tool: Tool): void { this.activeTool.set(tool); }
  selectColor(color: string): void {
    this.activeColor.set(color);
    this.activeTool.set('pen');
  }

  clearCanvas(): void {
    if (!confirm('Clear all strokes? This cannot be undone.')) return;
    const canvas = this.canvasRef.nativeElement;
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.drawing.update((d) => d ? { ...d, strokes: [] } : d);
  }


  submitComment(): void {
    if (this.commentForm.invalid) return;
    const drawingId = this.drawing()?._id;
    if (!drawingId) return;

    this.isSavingComment.set(true);
    const editId = this.editingCommentId();

    if (editId) {
      this.commentService.updateComment(editId, { text: this.commentForm.controls.text.getRawValue() })
        .pipe(finalize(() => this.isSavingComment.set(false))).subscribe({
          next: (r) => {
            this.comments.update((list) => list.map((c) => c._id === editId ? r.data.comment : c));
            this.commentForm.reset();
            this.editingCommentId.set(null);
          },
          error: (e) => this.pageError.set(e.error?.message ?? 'Could not update comment.'),
        });
    } else {
      this.commentService.createComment(drawingId, { text: this.commentForm.controls.text.getRawValue() })
        .pipe(finalize(() => this.isSavingComment.set(false))).subscribe({
          next: (r) => {
            this.comments.update((list) => [...list, r.data.comment]);
            this.commentForm.reset();
          },
          error: (e) => this.pageError.set(e.error?.message ?? 'Could not post comment.'),
        });
    }
  }

  editComment(comment: Comment): void {
    this.editingCommentId.set(comment._id);
    this.commentForm.controls.text.setValue(comment.text);
  }

  deleteComment(comment: Comment): void {
    if (!confirm('Delete this comment?')) return;
    this.commentService.deleteComment(comment._id).subscribe({
      next: () => this.comments.update((list) => list.filter((c) => c._id !== comment._id)),
      error: (e) => this.pageError.set(e.error?.message ?? 'Could not delete comment.'),
    });
  }

  cancelEdit(): void {
    this.editingCommentId.set(null);
    this.commentForm.reset();
  }


  inviteCollaborator(): void {
    if (this.inviteForm.invalid) return;
    const drawingId = this.drawing()?._id;
    if (!drawingId) return;

    this.drawingService.inviteCollaborator(drawingId, this.inviteForm.controls.email.getRawValue())
      .subscribe({
        next: (r) => {
          this.drawing.set(r.data.drawing);
          this.inviteForm.reset();
        },
        error: (e) => this.pageError.set(e.error?.message ?? 'Could not invite.'),
      });
  }

  copyJoinCode(): void {
    const code = this.drawing()?.joinCode;
    if (code) navigator.clipboard.writeText(code);
  }

  isOwner(): boolean {
    return this.drawing()?.ownerId._id === this.currentUser()?.id;
  }

  isCommentAuthor(comment: Comment): boolean {
    return comment.userId._id === this.currentUser()?.id;
  }

  trackById(_: number, c: Comment): string { return c._id; }

  goBack(): void { this.router.navigateByUrl('/dashboard'); }
}

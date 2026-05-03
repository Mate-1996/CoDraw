import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs/operators';

import { AuthService } from '../../core/auth.service';
import { DrawingService } from '../../core/drawing.service';
import { Drawing } from '../../core/models';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './dashboard-page.component.html',
  styleUrl: './dashboard-page.component.css',
})
export class DashboardPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly drawingService = inject(DrawingService);
  private readonly router = inject(Router);

  readonly currentUser = computed(() => this.authService.currentUser());
  readonly drawings = signal<Drawing[]>([]);
  readonly isLoading = signal(true);
  readonly pageError = signal('');
  readonly isSaving = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly showJoinModal = signal(false);
  readonly showCreateModal = signal(false);

  readonly createForm = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(2)]],
    description: [''],
    isPublic: [false],
  });

  readonly joinForm = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.minLength(4)]],
  });

  constructor() {
    this.loadDrawings();
  }

  loadDrawings(): void {
    this.isLoading.set(true);
    this.drawingService.getDrawings()
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (r) => this.drawings.set(r.data.drawings),
        error: (e) => this.pageError.set(e.error?.message ?? 'Could not load drawings.'),
      });
  }

  openDrawing(drawing: Drawing): void {
    this.router.navigate(['/drawing', drawing._id]);
  }

  createDrawing(): void {
    if (this.createForm.invalid) { this.createForm.markAllAsTouched(); return; }
    this.isSaving.set(true);
    this.drawingService.createDrawing({
      title: this.createForm.controls.title.getRawValue(),
      description: this.createForm.controls.description.getRawValue(),
      isPublic: this.createForm.controls.isPublic.getRawValue(),
    }).pipe(finalize(() => this.isSaving.set(false))).subscribe({
      next: (r) => {
        this.drawings.update((d) => [r.data.drawing, ...d]);
        this.createForm.reset({ title: '', description: '', isPublic: false });
        this.showCreateModal.set(false);
      },
      error: (e) => this.pageError.set(e.error?.message ?? 'Could not create drawing.'),
    });
  }

  joinDrawing(): void {
    if (this.joinForm.invalid) { this.joinForm.markAllAsTouched(); return; }
    this.isSaving.set(true);
    this.drawingService.joinByCode(this.joinForm.controls.code.getRawValue())
      .pipe(finalize(() => this.isSaving.set(false))).subscribe({
        next: (r) => {
          const exists = this.drawings().some((d) => d._id === r.data.drawing._id);
          if (!exists) this.drawings.update((d) => [r.data.drawing, ...d]);
          this.joinForm.reset();
          this.showJoinModal.set(false);
          this.router.navigate(['/drawing', r.data.drawing._id]);
        },
        error: (e) => this.pageError.set(e.error?.message ?? 'Could not join drawing.'),
      });
  }

  deleteOrLeave(drawing: Drawing, event: Event): void {
    event.stopPropagation();
    const isOwner = drawing.ownerId._id === this.currentUser()?.id;
    const msg = isOwner
      ? `Delete "${drawing.title}"? This cannot be undone.`
      : `Leave "${drawing.title}"?`;
    if (!confirm(msg)) return;

    this.drawingService.deleteOrLeave(drawing._id).subscribe({
      next: () => this.drawings.update((d) => d.filter((x) => x._id !== drawing._id)),
      error: (e) => this.pageError.set(e.error?.message ?? 'Operation failed.'),
    });
  }

  isOwner(drawing: Drawing): boolean {
    return drawing.ownerId._id === this.currentUser()?.id;
  }

  trackById(_: number, d: Drawing): string { return d._id; }

  logout(): void {
    this.authService.logout();
    this.router.navigateByUrl('/login');
  }
}

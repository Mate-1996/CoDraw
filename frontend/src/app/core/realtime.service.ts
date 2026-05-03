import { Injectable, signal } from '@angular/core';
import { Socket, io } from 'socket.io-client';
import { Subject } from 'rxjs';
import { environment } from '../../environments/environment';
import { Stroke } from './models';

export interface RemoteCursor {
  userId: string;
  x: number;
  y: number;
}

export interface RemoteStrokePoint {
  userId: string;
  strokeId: string;
  point: { x: number; y: number };
}

@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private socket: Socket | null = null;


  readonly strokeStart$ = new Subject<{ userId: string; stroke: Stroke & { tempId: string } }>();
  readonly strokePoint$ = new Subject<RemoteStrokePoint>();
  readonly strokeEnd$ = new Subject<{ userId: string; stroke: Stroke }>();
  readonly cursorMove$ = new Subject<RemoteCursor>();
  readonly cursorLeave$ = new Subject<{ userId: string }>();
  readonly collaboratorJoined$ = new Subject<{ userId: string }>();
  readonly collaboratorOnline$ = new Subject<{ userId: string }>();
  readonly collaboratorOffline$ = new Subject<{ userId: string }>();
  readonly commentAdded$ = new Subject<{ comment: unknown }>();

  readonly onlineUsers = signal<Set<string>>(new Set());

  connect(token: string): void {
    if (this.socket?.connected) return;

    this.socket = io(environment.apiUrl, {
      transports: ['websocket'],
      auth: { token },
    });

    this.socket.on('collaborator:online', ({ userId }: { userId: string }) => {
      this.onlineUsers.update((s) => new Set([...s, userId]));
      this.collaboratorOnline$.next({ userId });
    });

    this.socket.on('collaborator:offline', ({ userId }: { userId: string }) => {
      this.onlineUsers.update((s) => { const n = new Set(s); n.delete(userId); return n; });
      this.collaboratorOffline$.next({ userId });
    });

    this.socket.on('collaborator:joined', (data: { userId: string }) => {
      this.collaboratorJoined$.next(data);
    });

    this.socket.on('stroke:start', (data: { userId: string; stroke: Stroke & { tempId: string } }) => {
      this.strokeStart$.next(data);
    });

    this.socket.on('stroke:point', (data: RemoteStrokePoint) => {
      this.strokePoint$.next(data);
    });

    this.socket.on('stroke:end', (data: { userId: string; stroke: Stroke }) => {
      this.strokeEnd$.next(data);
    });

    this.socket.on('cursor:move', (data: RemoteCursor) => {
      this.cursorMove$.next(data);
    });

    this.socket.on('cursor:leave', (data: { userId: string }) => {
      this.cursorLeave$.next(data);
    });

    this.socket.on('comment:added', (data: { comment: unknown }) => {
      this.commentAdded$.next(data);
    });
  }

  joinDrawing(drawingId: string): void {
    this.socket?.emit('drawing:join', { drawingId });
  }

  leaveDrawing(drawingId: string): void {
    this.socket?.emit('drawing:leave', { drawingId });
    this.onlineUsers.set(new Set());
  }

  emitStrokeStart(drawingId: string, stroke: Stroke & { tempId: string }): void {
    this.socket?.emit('stroke:start', { drawingId, stroke });
  }

  emitStrokePoint(drawingId: string, strokeId: string, point: { x: number; y: number }): void {
    this.socket?.emit('stroke:point', { drawingId, strokeId, point });
  }

  emitStrokeEnd(drawingId: string, stroke: Stroke): void {
    this.socket?.emit('stroke:end', { drawingId, stroke });
  }

  emitCursorMove(drawingId: string, x: number, y: number): void {
    this.socket?.emit('cursor:move', { drawingId, x, y });
  }

  emitCursorLeave(drawingId: string): void {
    this.socket?.emit('cursor:leave', { drawingId });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.onlineUsers.set(new Set());
  }
}

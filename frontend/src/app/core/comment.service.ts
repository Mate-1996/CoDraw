import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { ApiResponse, Comment } from './models';

@Injectable({ providedIn: 'root' })
export class CommentService {
  private readonly http = inject(HttpClient);

  getComments(drawingId: string) {
    return this.http.get<ApiResponse<{ comments: Comment[] }>>(`${environment.apiUrl}/drawings/${drawingId}/comments`);
  }

  createComment(drawingId: string, payload: { text: string; pinX?: number | null; pinY?: number | null }) {
    return this.http.post<ApiResponse<{ comment: Comment }>>(`${environment.apiUrl}/drawings/${drawingId}/comments`, payload);
  }

  updateComment(commentId: string, payload: { text?: string; pinX?: number | null; pinY?: number | null }) {
    return this.http.patch<ApiResponse<{ comment: Comment }>>(`${environment.apiUrl}/comments/${commentId}`, payload);
  }

  deleteComment(commentId: string) {
    return this.http.delete<ApiResponse<{ comment: Comment }>>(`${environment.apiUrl}/comments/${commentId}`);
  }
}

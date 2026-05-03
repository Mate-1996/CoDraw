import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { ApiResponse, Drawing } from './models';

@Injectable({ providedIn: 'root' })
export class DrawingService {
  private readonly http = inject(HttpClient);

  getDrawings() {
    return this.http.get<ApiResponse<{ drawings: Drawing[] }>>(`${environment.apiUrl}/drawings`);
  }

  getDrawing(id: string) {
    return this.http.get<ApiResponse<{ drawing: Drawing }>>(`${environment.apiUrl}/drawings/${id}`);
  }

  createDrawing(payload: { title: string; description?: string; isPublic?: boolean }) {
    return this.http.post<ApiResponse<{ drawing: Drawing }>>(`${environment.apiUrl}/drawings`, payload);
  }

  updateDrawing(id: string, payload: { title?: string; description?: string; isPublic?: boolean }) {
    return this.http.patch<ApiResponse<{ drawing: Drawing }>>(`${environment.apiUrl}/drawings/${id}`, payload);
  }

  deleteOrLeave(id: string) {
    return this.http.delete<ApiResponse<{ drawing: Drawing }>>(`${environment.apiUrl}/drawings/${id}`);
  }

  joinByCode(code: string) {
    return this.http.post<ApiResponse<{ drawing: Drawing }>>(`${environment.apiUrl}/drawings/join`, { code });
  }

  inviteCollaborator(drawingId: string, email: string) {
    return this.http.post<ApiResponse<{ drawing: Drawing }>>(`${environment.apiUrl}/drawings/${drawingId}/invite`, { email });
  }
}

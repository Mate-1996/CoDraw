import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

import { environment } from '../../environments/environment';
import { ApiResponse, UserProfile } from './models';

interface LoginPayload { email: string; password: string; }
interface RegisterPayload { name: string; email: string; password: string; }
interface AuthData { token: string; user: UserProfile; }

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly storageKey = 'codraw_session';
  private readonly session = signal<{ token: string; user: UserProfile } | null>(this.restoreSession());

  readonly currentUser = computed(() => this.session()?.user ?? null);
  readonly token = computed(() => this.session()?.token ?? null);
  readonly isAuthenticated = computed(() => Boolean(this.token()));

  login(payload: LoginPayload): Observable<ApiResponse<AuthData>> {
    return this.http
      .post<ApiResponse<AuthData>>(`${environment.apiUrl}/auth/login`, payload)
      .pipe(tap((r) => this.setSession(r.data)));
  }

  register(payload: RegisterPayload): Observable<ApiResponse<{ user: UserProfile }>> {
    return this.http.post<ApiResponse<{ user: UserProfile }>>(`${environment.apiUrl}/auth/register`, payload);
  }

  fetchMe(): Observable<ApiResponse<{ user: UserProfile }>> {
    return this.http
      .get<ApiResponse<{ user: UserProfile }>>(`${environment.apiUrl}/auth/me`)
      .pipe(tap((r) => this.patchUser(r.data.user)));
  }

  logout(): void {
    this.session.set(null);
    localStorage.removeItem(this.storageKey);
  }

  private setSession(data: AuthData): void {
    this.session.set(data);
    localStorage.setItem(this.storageKey, JSON.stringify(data));
  }

  private patchUser(user: UserProfile): void {
    const s = this.session();
    if (!s) return;
    this.setSession({ token: s.token, user });
  }

  private restoreSession(): { token: string; user: UserProfile } | null {
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { localStorage.removeItem(this.storageKey); return null; }
  }
}

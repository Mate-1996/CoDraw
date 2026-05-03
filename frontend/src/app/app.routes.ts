import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { AuthPageComponent } from './features/auth/auth-page.component';
import { DashboardPageComponent } from './features/dashboard/dashboard-page.component';
import { DrawingPageComponent } from './features/drawing/drawing-page.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: 'login', component: AuthPageComponent, data: { mode: 'login' } },
  { path: 'register', component: AuthPageComponent, data: { mode: 'register' } },
  { path: 'dashboard', component: DashboardPageComponent, canActivate: [authGuard] },
  { path: 'drawing/:id', component: DrawingPageComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: 'login' },
];
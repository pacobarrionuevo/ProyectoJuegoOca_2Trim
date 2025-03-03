import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { User } from '../models/User';
import { AuthRequest } from '../models/auth-request';
import { AuthResponse } from '../models/auth-response';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private baseURL = `${environment.apiUrl}`;
  private loggedIn = new BehaviorSubject<boolean>(this.hasToken());
  private isAdminSubject = new BehaviorSubject<boolean>(this.checkAdmin());

  constructor(private http: HttpClient) { }

  private hasToken(): boolean {
    return !!localStorage.getItem('accessToken');
  }

  private checkAdmin(): boolean {
    const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
    if (!token) return false;
    
    try {
      const payload = this.decodeToken(token);
      return payload.Rol === 'admin';
    } catch (e) {
      console.error('Error decodificando el token:', e);
      return false;
    }
  }

  private decodeToken(token: string): any {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  }

  get isLoggedIn$(): Observable<boolean> {
    return this.loggedIn.asObservable();
  }

  get isAdmin$(): Observable<boolean> {
    return this.isAdminSubject.asObservable();
  }

  login(authData: AuthRequest, rememberMe: boolean): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseURL}/api/Usuario/login`, authData).pipe(
      tap((response: AuthResponse) => {
        localStorage.removeItem('accessToken');
        sessionStorage.removeItem('accessToken');
        localStorage.removeItem('isAdmin');
        sessionStorage.removeItem('isAdmin');
  
        if (rememberMe) {
          localStorage.setItem('accessToken', response.stringToken);
          localStorage.setItem('isAdmin', JSON.stringify(response.isadmin));
        } else {
          sessionStorage.setItem('accessToken', response.stringToken);
          sessionStorage.setItem('isAdmin', JSON.stringify(response.isadmin));
        }
        
        // Actualizar estados
        this.loggedIn.next(true);
        this.isAdminSubject.next(this.checkAdmin()); 
      })
    );
  }

  logout(): void {
    localStorage.removeItem('accessToken');
    sessionStorage.removeItem('accessToken');
    this.loggedIn.next(false);
    this.isAdminSubject.next(false);
  }

  register(formData: FormData): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseURL}/api/Usuario/Registro`, formData, { headers: {} });
  }

  updateAuthState(): void {
    this.loggedIn.next(this.hasToken());
    this.isAdminSubject.next(this.checkAdmin());
  }
  getUserDataFromToken(): any {
    const token = localStorage.getItem('accessToken');
    if (token) {
      const parts = token.split('.');
      if (parts.length !== 3) {
        console.error('El token no está bien estructurado.');
        return null;
      }
      const payloadBase64 = parts[1];
      const payloadJson = atob(payloadBase64);

      try {
        const payload = JSON.parse(payloadJson);
        return {
          id: payload.id || 'ID no disponible',
          name: payload.Apodo || 'Nombre no disponible',
          email: payload.Email || 'Correo no disponible',
          profilePicture: payload.FotoPerfil || 'Foto no disponible'
        };
      } catch (e) {
        console.error('Error al parsear el JSON del payload:', e);
        return null;
      }
    }
    return null;
  }
  getUserData(): { 
    id: number, 
    apodo: string, 
    email: string, 
    fotoPerfil: string,
    esAdmin: boolean 
  } | null {
    const token = localStorage.getItem('accessToken');
    if (!token) return null;

    try {
      const payload = this.decodeToken(token);
      return {
        id: payload.id,
        apodo: payload.Apodo,
        email: payload.Email,
        fotoPerfil: payload.FotoPerfil,
        esAdmin: payload.Rol === 'admin'
      };
    } catch (e) {
      console.error('Error obteniendo datos del usuario:', e);
      return null;
    }
  }
}
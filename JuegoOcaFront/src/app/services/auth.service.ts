import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, tap } from 'rxjs';
import { AuthRequest } from '../models/auth-request';
import { AuthResponse } from '../models/auth-response';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private URL = `${environment.apiUrl}`; 
  private loggedIn = new BehaviorSubject<boolean>(this.hasToken());

  constructor(private http: HttpClient) {}

  private hasToken(): boolean {
    return !!localStorage.getItem('accessToken') || !!sessionStorage.getItem('accessToken');
  }

  get isLoggedIn() {
    return this.loggedIn.asObservable();
  }

  register(formData: FormData): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.URL}/api/Usuario/Registro`, formData, { headers: {} });
  }

  login(authData: AuthRequest, rememberMe: boolean): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.URL}/api/Usuario/login`, authData).pipe(
      tap((response: AuthResponse) => {
        // Borra ambos Storage antes de guardar el token
        localStorage.removeItem('accessToken');
        sessionStorage.removeItem('accessToken');

        // Guarda el token según la opción de recuerdame
        if (rememberMe) {
          localStorage.setItem('accessToken', response.stringToken);
        } else {
          sessionStorage.setItem('accessToken', response.stringToken);
        }
        this.loggedIn.next(true);
      })
    );
  }

  logout(): void {
    localStorage.removeItem('accessToken');
    sessionStorage.removeItem('accessToken');
    this.loggedIn.next(false);
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
}

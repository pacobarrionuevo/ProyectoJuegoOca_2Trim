import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuthRequest } from '../models/auth-request';
import { AuthResponse } from '../models/auth-response';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private URL = `${environment.apiUrl}`;
    //Behavior Subject es para que actualize el header nada más iniciar sesion para que salga el botón del usuario y el botón admin
  private loggedIn = new BehaviorSubject<boolean>(this.hasToken());
  private isAdminSubject = new BehaviorSubject<boolean>(this.checkAdmin());

  constructor(private http: HttpClient) {}
//mira si tiene token
  private hasToken(): boolean {
    return !!localStorage.getItem('accessToken');
  }
//checkea si es admin
  private checkAdmin(): boolean {
    const token = localStorage.getItem('accessToken');
    if (token) {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return false;
      }
      const payloadBase64 = parts[1];
      const payloadJson = atob(payloadBase64);
      try {
        const payload = JSON.parse(payloadJson);
        return payload.esAdmin === true;
      } catch (e) {
        return false;
      }
    }
    return false;
  }

  get isLoggedIn() {
    return this.loggedIn.asObservable();
  }

  get isAdmin() {
    return this.isAdminSubject.asObservable();
  }

  register(authData: AuthRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.URL}ControladorUsuario/Registro`, authData);
  }

  login(authData: AuthRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.URL}ControladorUsuario/login`, authData).pipe(
      tap((response: AuthResponse) => {
        localStorage.setItem('accessToken', response.stringToken);
        this.loggedIn.next(true);
        this.isAdminSubject.next(this.checkAdmin());
      })
    );
  }
//lógica del log out
  logout(): void {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('usuarioId');
    this.loggedIn.next(false);
    this.isAdminSubject.next(false);
  }
//consigue los datos del token
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
          name: payload.Nombre || 'Nombre no disponible',
          email: payload.Email || 'Correo no disponible',
          address: payload.Direccion || 'Dirección no disponible',
          esAdmin: payload.esAdmin || false
        };
      } catch (e) {
        console.error('Error al parsear el JSON del payload:', e);
        return null;
      }
    }
    return null;
  }
//actualiza los datos de usuario
  updateUserData(user: any): Observable<any> {
    return this.http.post<any>(`${this.URL}ControladorUsuario/update`, user);
  }
}

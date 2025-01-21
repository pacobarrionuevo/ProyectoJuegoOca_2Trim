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
    private URL = `${environment.apiUrl}`; // Ruta base para el controlador

    //Behavior Subject es para que actualize la vista nada más iniciar sesion para que salga el botón del usuario y el botón admin
    private loggedIn = new BehaviorSubject<boolean>(this.hasToken());

    constructor(private http: HttpClient) {}
  //mira si tiene token
    private hasToken(): boolean {
    return !!localStorage.getItem('accessToken');
    }
    get isLoggedIn() {
      return this.loggedIn.asObservable();
    }
    // Método para registrar un nuevo usuario
    register(authData: AuthRequest): Observable<AuthResponse> {
      return this.http.post<AuthResponse>(`${this.URL}/api/UsuarioControlador/Registro`, authData);
    }
    login(authData: AuthRequest): Observable<AuthResponse> {
      return this.http.post<AuthResponse>(`${this.URL}/api/UsuarioControlador/login`, authData).pipe(
        tap((response: AuthResponse) => {
          localStorage.setItem('accessToken', response.stringToken);
          this.loggedIn.next(true);
  })
);
}
    logout(): void {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('usuarioId');
      localStorage.removeItem('authData');
      this.loggedIn.next(false);
    }
    
  }

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

  //Behavior Subject es para que actualice la vista nada más iniciar sesión para que salga el botón del usuario y el botón admin
  private loggedIn = new BehaviorSubject<boolean>(this.hasToken());

  constructor(private http: HttpClient) {}

  private hasToken(): boolean {
    return !!localStorage.getItem('accessToken') || !!sessionStorage.getItem('accessToken');
  }

  get isLoggedIn() {
    return this.loggedIn.asObservable();
  }

  register(formData: FormData): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.URL}/api/Usuario/Registro`, formData, {headers: {}});
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
    localStorage.removeItem('usuarioId');
    localStorage.removeItem('authData');
    this.loggedIn.next(false);
  }
}

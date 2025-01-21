import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable} from 'rxjs';

import { AuthRequest } from '../models/auth-request';
import { AuthResponse } from '../models/auth-response';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private URL = `${environment.apiUrl}`; // Ruta base para el controlador

  constructor(private http: HttpClient) {}

  registerUser(userData: any, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('UsuarioApodo', userData.UsuarioApodo);
    formData.append('UsuarioEmail', userData.UsuarioEmail);
    formData.append('UsuarioContrasena', userData.UsuarioContrasena);
    formData.append('UsuarioConfirmarContrasena', userData.UsuarioConfirmarContrasena);
    formData.append('UsuarioFotoPerfil', file);

    return this.http.post(`${this.URL}/api/UsuarioController/Registro`, formData);
  }
  login(authData: AuthRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.URL}/api/UsuarioController/login`, authData);
  }
}

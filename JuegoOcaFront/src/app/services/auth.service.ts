import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';

import { AuthRequest } from '../models/auth-request';
import { AuthResponse } from '../models/auth-response';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private URL = `${environment.apiUrl}`; // Ruta base para el controlador

  constructor(private http: HttpClient) {}

  // Método para registrar un nuevo usuario
  register(authData: AuthRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.URL}/api/Usuario/Registro`, authData);
  }
  login(authData: AuthRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.URL}/api/Usuario/Login`, authData);
  }
}
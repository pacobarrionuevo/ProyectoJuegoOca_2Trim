import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { User } from '../models/User';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private baseURL = `${environment.apiUrl}/api`;

  constructor(private http: HttpClient) { }

  getUsuarios(): Observable<User[]> {
    return this.http.get<User[]>(`${this.baseURL}/Usuario/usuarios`);
  }

  actualizarRol(usuarioId: number, nuevoRol: string): Observable<User> {
    return this.http.patch<User>(`${this.baseURL}/usuarios/${usuarioId}/rol`, { 
      NuevoRol: nuevoRol 
    });
  }

  toggleBaneo(usuarioId: number): Observable<User> {
    return this.http.patch<User>(`${this.baseURL}/usuarios/${usuarioId}/baneo`, {});
  }
}
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { SolicitudAmistad } from '../models/solicitud-amistad';

@Injectable({
  providedIn: 'root'
})
export class FriendService {
  private apiUrl = 'https://tu-api.com/api/friend-requests'; // Cambia por la URL correcta

  constructor(private http: HttpClient) { }

  getPendingRequests(): Observable<SolicitudAmistad[]> {
    return this.http.get<SolicitudAmistad[]>(`${this.apiUrl}/pending`);
  }

  aceptarSolicitud(amistadId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/accept`, { amistadId });
  }

  rechazarSolicitud(amistadId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/reject`, { amistadId });
  }
}

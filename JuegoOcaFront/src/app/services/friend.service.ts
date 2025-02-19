import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { SolicitudAmistad } from '../models/solicitud-amistad';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class FriendService {
  private apiUrl = `${environment.apiUrl}/api/FriendRequest`; 

  constructor(private http: HttpClient) { }

  getPendingRequests(): Observable<SolicitudAmistad[]> {
    return this.http.get<SolicitudAmistad[]>(`${this.apiUrl}/pending`);
  }

  aceptarSolicitud(amistadId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/accept?amistadId=`, { amistadId });
  }

  rechazarSolicitud(amistadId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/reject?amistadId=`, { amistadId });
  }
}

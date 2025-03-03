import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { SolicitudAmistad } from '../models/solicitud-amistad';
import { User } from '../models/User';
import { SendFriendRequest } from '../models/send-friend-request';

@Injectable({
  providedIn: 'root'
})
export class FriendService {
  private apiUrl = `${environment.apiUrl}/api/FriendRequest`;
  
  constructor(private http: HttpClient) { }

  getFriendsList(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/friends`, {
      headers: this.getHeader()
    });
  }

  getPendingRequests(): Observable<SolicitudAmistad[]> {
    return this.http.get<SolicitudAmistad[]>(`${this.apiUrl}/pending`, {
      headers: this.getHeader()
    });
  }

  sendFriendRequest(receiverId: number): Observable<SendFriendRequest> {
    const params = new HttpParams().set('receiverId', receiverId.toString());
    return this.http.post<SendFriendRequest>(`${this.apiUrl}/send`, {}, {
      headers: this.getHeader(),
      params: params
    });
  }
  
  aceptarSolicitud(amistadId: number | null): Observable<any> {
    if (amistadId == null) {
      console.error('Error: amistadId es null o undefined');
      return throwError(() => new Error('amistadId es null o undefined'));
    }
    
    const params = new HttpParams().set('amistadId', amistadId.toString());
    return this.http.post(`${this.apiUrl}/accept`, null, {
      headers: this.getHeader(),
      params: params
    });
  }
  
  rechazarSolicitud(amistadId: number): Observable<any> {
    const params = new HttpParams().set('amistadId', amistadId.toString());
    return this.http.post(`${this.apiUrl}/reject`, null, {
      headers: this.getHeader(),
      params: params
    });
  }

  private getHeader(contentType: string | null = 'application/json'): HttpHeaders {
    const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
    let headers: any = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (contentType) {
      headers['Content-Type'] = contentType;
    }
    return new HttpHeaders(headers);
  }
}
function throwError(arg0: () => Error): Observable<any> {
  throw new Error('Function not implemented.');
}

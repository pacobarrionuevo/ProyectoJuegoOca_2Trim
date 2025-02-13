import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams, HttpResponse } from '@angular/common/http';
import { Result } from '../models/result';
import { Observable, lastValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { User } from '../models/User';


@Injectable({
  providedIn: 'root'
})
export class ApiService {

  private BASE_URL = environment.apiUrl;

  jwt: string | undefined;

  constructor(private http: HttpClient) { }

  getUsuarios(): Observable<User[]> {
    return this.http.get<User[]>(`${this.BASE_URL}/api/Usuario/ListaUsuario`);
  }



  getFriendsList(usuarioId: number): Observable<User[]> {
    return this.http.get<User[]>(`${this.BASE_URL}/api/FriendRequest/friends/${usuarioId}`);
  }

  getPendingFriendRequests(usuarioId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.BASE_URL}/api/FriendRequest/pending/${usuarioId}`);
  }

  sendFriendRequest(receiverId: number): Observable<any> {
    const params = new HttpParams().set('receiverId', receiverId.toString());
    return this.http.post(`${this.BASE_URL}/api/FriendRequest/send`, {}, {
      headers: this.getHeader(),
      params: params
    });
  }
  
  
  acceptFriendRequest(amistadId: number): Observable<any> {
    return this.http.post(`${this.BASE_URL}/api/FriendRequest/accept`, { amistadId }, {
      headers: this.getHeader()
    });
  }
  
  
  rejectFriendRequest(amistadId: number): Observable<any> {
    return this.http.post(`${this.BASE_URL}/api/FriendRequest/reject`, null, {
      headers: this.getHeader(),
      params: { amistadId: amistadId.toString() }
    });
  }
  
  // Métodos existentes (get, post, put, delete, sendRequest, getHeader)
  async get<T = void>(path: string, params: any = {}, responseType: 'json' | 'text' | 'blob' | 'arraybuffer' = 'json'): Promise<Result<T>> {
    const url = `${this.BASE_URL}${path}`;
    const request$ = this.http.get(url, {
      params: new HttpParams({ fromObject: params }),
      headers: this.getHeader(),
      responseType: responseType as any,
      observe: 'response',
    });

    return this.sendRequest<T>(request$);
  }

  async post<T = void>(path: string, body: Object = {}, contentType = null): Promise<Result<T>> {
    const url = `${this.BASE_URL}${path}`;
    const request$ = this.http.post(url, body, {
      headers: this.getHeader(contentType),
      observe: 'response'
    });

    return this.sendRequest<T>(request$);
  }

  async put<T = void>(path: string, body: Object = {}, contentType = null): Promise<Result<T>> {
    const url = `${this.BASE_URL}${path}`;
    const request$ = this.http.put(url, body, {
      headers: this.getHeader(contentType),
      observe: 'response'
    });

    return this.sendRequest<T>(request$);
  }

  async delete<T = void>(path: string, params: any = {}): Promise<Result<T>> {
    const url = `${this.BASE_URL}${path}`;
    const request$ = this.http.delete(url, {
      params: new HttpParams({ fromObject: params }),
      headers: this.getHeader(),
      observe: 'response'
    });

    return this.sendRequest<T>(request$);
  }

  private async sendRequest<T = void>(request$: Observable<HttpResponse<any>>): Promise<Result<T>> {
    let result: Result<T>;
    
    try {
      const response = await lastValueFrom(request$);
      const statusCode = response.status;

      if (response.ok) {
        const data = response.body as T;

        if (data == undefined) {
          result = Result.success(statusCode);
        } else {
          result = Result.success(statusCode, data);
        }
      } else {
        result = result = Result.error(statusCode, response.statusText);
      }
    } catch (exception) {
      if (exception instanceof HttpErrorResponse) {
        result = Result.error(exception.status, exception.statusText);
      } else if (exception instanceof Error) {
        result = Result.error(-1, exception.message || 'Unknown error');
      } else {
        result = Result.error(-1);
      }
    }

    return result;
  }

  private getHeader(contentType: string | null = 'application/json'): HttpHeaders {
    const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
    let header: any = {};
  
    if (token) {
      header['Authorization'] = `Bearer ${token}`;  
    }
    if (contentType) {
      header['Content-Type'] = contentType;
    }
    return new HttpHeaders(header);
  }
  
}
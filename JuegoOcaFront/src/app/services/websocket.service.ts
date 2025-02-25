import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';

@Injectable({
  providedIn: 'root'
})
export class WebsocketService {
  connected = new Subject<void>();
  messageReceived = new Subject<any>();
  disconnected = new Subject<void>();
  rxjsSocket: WebSocketSubject<string>;

  private tokenKey = 'websocket_token';

  constructor() {
    this.reconnectIfNeeded();
  }

  isConnectedRxjs(): boolean {
    return this.rxjsSocket && !this.rxjsSocket.closed;
  }

  connectRxjs(token: string): void {
    this.rxjsSocket = webSocket({
      url: `wss://localhost:7077/ws/connect?token=${token}`,
      openObserver: { next: () => this.connected.next() },
      serializer: (value: string) => value,
      deserializer: (event: MessageEvent) => event.data
    });

    this.rxjsSocket.subscribe({
      next: (message: string) => this.handleMessage(message),
      error: (error) => this.handleError(error),
      complete: () => this.disconnected.next()
    });
  }

  sendRxjs(message: string): void {
    if (this.rxjsSocket && !this.rxjsSocket.closed) {
      this.rxjsSocket.next(message);
    }
  }

  disconnectRxjs(): void {
    if (this.rxjsSocket) {
      this.rxjsSocket.complete();
    }
  }

  private handleMessage(message: string): void {
    try {
      const parsedMessage = JSON.parse(message);
      
      // Convertir propiedades a camelCase si es necesario
      const normalizedMessage = this.normalizeKeys(parsedMessage);
      
      this.messageReceived.next(normalizedMessage);
    } catch (error) {
      console.error('Error al parsear el mensaje:', error);
    }
  }

  private handleError(error: any): void {
    console.error('Error en WebSocket:', error);
    this.disconnected.next();
  }
  private normalizeKeys(obj: any): any {
    if (typeof obj !== 'object' || obj === null) return obj;
    
    return Object.keys(obj).reduce((acc: any, key) => {
      const camelKey = key.charAt(0).toLowerCase() + key.slice(1);
      acc[camelKey] = this.normalizeKeys(obj[key]);
      return acc;
    }, {});
  }

  private reconnectIfNeeded(): void {
    const storedToken = localStorage.getItem(this.tokenKey);
    if (storedToken) {
      this.connectRxjs(storedToken);
    }
  }
}
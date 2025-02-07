import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { environment } from '../../environments/environment';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';

@Injectable({
  providedIn: 'root'
})
export class WebsocketService {

  // Eventos
  connected = new Subject<void>();
  messageReceived = new Subject<any>();
  disconnected = new Subject<void>();

  private onConnected() {
    console.log('Socket connected');
    this.connected.next();
  }

  private onMessageReceived(message: string) {
    this.messageReceived.next(message);
  }

  private onError(error: any) {
    console.error('Error:', error);
  }

  private onDisconnected() {
    console.log('WebSocket connection closed');
    this.disconnected.next();
  }

  // ============ Usando Rxjs =============

  rxjsSocket: WebSocketSubject<string>;

  isConnectedRxjs() {
    return this.rxjsSocket && !this.rxjsSocket.closed;
  }

  connectRxjs(token: string) {
    this.rxjsSocket = webSocket({
      // Aquí es donde agregamos el token a la URL
      url: `wss://localhost:7077/ws/connect?token=${token}`,
  
      openObserver: {
        next: () => this.onConnected()
      },
  
      serializer: (value: string) => value,
      deserializer: (event: MessageEvent) => event.data
    });
  
    this.rxjsSocket.subscribe({
      next: (message: string) => this.onMessageReceived(message),
      error: (error) => this.onError(error),
      complete: () => this.onDisconnected()
    });
  }
  

  sendRxjs(message: string) {
    this.rxjsSocket.next(message);
  }

  disconnectRxjs() {
    this.rxjsSocket.complete();
    this.rxjsSocket = null;
  }
}

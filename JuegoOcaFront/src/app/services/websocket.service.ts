import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { environment } from '../../environments/environment';
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

  private onConnected() {
    console.log('Socket connected');
    this.connected.next();
  }

  private onMessageReceived(message: string) {
    console.log("Mensaje recibido desde WebSocket:", message);
    try {
      const parsedMessage = JSON.parse(message);
      console.log("Mensaje parseado correctamente:", parsedMessage);
  
      if (parsedMessage.Message === "amigo conectado") {
        this.messageReceived.next({ FriendId: parsedMessage.FriendId, Estado: "Conectado" });
      } else if (parsedMessage.Message === "amigo desconectado") {
        this.messageReceived.next({ FriendId: parsedMessage.FriendId, Estado: "Desconectado" });
      }

    } catch (error) {
      console.error("Error al parsear el mensaje WebSocket:", error);
    }
  }

  private onError(error: any) {
    console.error('Error:', error);
  }

  private onDisconnected() {
    console.log('WebSocket connection closed');
    this.disconnected.next();
  }

  isConnectedRxjs() {
    return this.rxjsSocket && !this.rxjsSocket.closed;
  }

  connectRxjs(token: string) {
    if (this.isConnectedRxjs()) {
      console.log('WebSocket ya está conectado.');
      return;
    }

    localStorage.setItem(this.tokenKey, token);

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
    if (this.isConnectedRxjs()) {
      this.rxjsSocket.next(message);
    } else {
      console.warn('No se puede enviar el mensaje. WebSocket no conectado.');
    }
  }

  disconnectRxjs() {
    if (this.rxjsSocket) {
      this.rxjsSocket.complete();
      this.rxjsSocket = null;
    }
    localStorage.removeItem(this.tokenKey);
  }

  private reconnectIfNeeded() {
    const storedToken = localStorage.getItem(this.tokenKey);
    if (storedToken) {
      console.log('Reconectando WebSocket después de recarga...');
      this.connectRxjs(storedToken);
    }
  }
}

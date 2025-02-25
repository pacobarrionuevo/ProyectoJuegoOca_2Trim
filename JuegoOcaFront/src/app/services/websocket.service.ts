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

  activeConnections = new Subject<number>();

  private tokenKey = 'websocket_token';

  constructor() {
    this.reconnectIfNeeded();
  }

  private onConnected() {
    console.log('WebSocketService: Socket connected');
    this.connected.next();
  }

  isConnectedRxjs() {
    const isConnected = this.rxjsSocket && !this.rxjsSocket.closed;
    console.log(`WebSocketService: isConnectedRxjs() -> ${isConnected}`);
    return isConnected;
  }

  connectRxjs(token: string): void {
    this.rxjsSocket = webSocket({
      url: `wss://localhost:7077/ws/connect?token=${token}`,
      openObserver: { next: () => this.connected.next() },
      serializer: (value: string) => value,
      deserializer: (event: MessageEvent) => event.data
    });
  
    // Suscribirse a los mensajes del WebSocket
    this.rxjsSocket.subscribe({
      next: (message: string) => this.handleMessage(message),
      error: (error) => this.handleError(error),
      complete: () => this.disconnected.next()
    });
  }

  sendRxjs(message: string): void {
    if (this.rxjsSocket && !this.rxjsSocket.closed) {
      console.log('WebSocketService: Enviando mensaje:', message);
      this.rxjsSocket.next(message);
    } else {
      console.error('WebSocketService: No se puede enviar el mensaje, WebSocket no está conectado');
    }
  }

  disconnectRxjs(): void {
    if (this.rxjsSocket) {
      console.log('WebSocketService: Desconectando WebSocket...');
      this.disconnected(); // Llamar el evento de desconexión
      this.rxjsSocket.complete(); // Finalizar la conexión      

      this.rxjsSocket.unsubscribe(); // Cerrar la suscripción
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
      console.log('WebSocketService: Reconectando WebSocket con token almacenado');
      this.connectRxjs(storedToken); // Intentar reconectar
    } else {
      console.log('WebSocketService: No hay token almacenado, no se puede reconectar');
    }
  }

  // Método para eliminar el token almacenado (por ejemplo, al cerrar sesión)
  clearToken() {
    sessionStorage.removeItem(this.tokenKey);
    console.log('WebSocketService: Token eliminado');
  }
}
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

  // ========= Usando Websockets nativos =============

  private nativeSocket: WebSocket;

  isConnectedNative() {
    return this.nativeSocket
      && (this.nativeSocket.readyState == WebSocket.CONNECTING || this.nativeSocket.readyState == WebSocket.OPEN);
  }

  connectNative() {
    this.nativeSocket = new WebSocket(environment.socketUrl);

    // Evento de apertura de conexión
    this.nativeSocket.onopen = _ => this.onConnected();

    // Evento de mensaje recibido
    this.nativeSocket.onmessage = (event) => this.onMessageReceived(event.data);

    // Evento de error generado
    this.nativeSocket.onerror = (event) => this.onError(event);

    // Evento de cierre de conexión
    this.nativeSocket.onclose = (event) => this.onDisconnected();
  }

  sendNative(message: string) {
    this.nativeSocket.send(message);
  }

  disconnectNative() {
    this.nativeSocket.close(1000, 'Closed by client');
    this.nativeSocket = null;
  }

  // ============ Usando Rxjs =============

  rxjsSocket: WebSocketSubject<string>;

  isConnectedRxjs() {
    return this.rxjsSocket && !this.rxjsSocket.closed;
  }

  connectRxjs() {
    this.rxjsSocket = webSocket({
      url: environment.socketUrl,

      // Evento de apertura de conexión
      openObserver: {
        next: () => this.onConnected()
      },

      // La versión de Rxjs está configurada por defecto para manejar JSON
      // Si queremos manejar cadenas de texto en crudo debemos configurarlo
      serializer: (value: string) => value,
      deserializer: (event: MessageEvent) => event.data
    });

    this.rxjsSocket.subscribe({
      // Evento de mensaje recibido
      next: (message: string) => this.onMessageReceived(message),

      // Evento de error generado
      error: (error) => this.onError(error),

      // Evento de cierre de conexión
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

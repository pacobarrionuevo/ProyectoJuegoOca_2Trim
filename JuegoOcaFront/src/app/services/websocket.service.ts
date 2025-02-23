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
  isConnectedRxjs() {
    return this.rxjsSocket && !this.rxjsSocket.closed;
  }

  private onMessageReceived(message: string) {
    console.log('Mensaje recibido en el frontend:', message);
    try {
      const parsedMessage = JSON.parse(message);
      if (parsedMessage.Type === 'friendInvitation') {
          const accept = confirm(`${parsedMessage.FromUserNickname} te ha invitado a jugar. ¿Aceptas?`);
          if (accept) {
              const response = {
                  type: 'acceptInvitation',
                  hostId: parsedMessage.FromUserId
              };
              this.sendRxjs(JSON.stringify(response));
          }
        
      } else if (parsedMessage.Type === 'gameStarted') {
        this.messageReceived.next({
          type: 'gameStarted',
          gameId: parsedMessage.GameId,
          opponent: parsedMessage.Opponent
        });
      } else if (parsedMessage.Type === 'waitingForOpponent') {
        this.messageReceived.next({
          type: 'waitingForOpponent'
        });
      }
    } catch (error) {
      console.error('Error al parsear el mensaje:', error);
    }
  }

  private onError(error: any) {
    console.error('Error:', error);
  }

  private onDisconnected() {
    console.log('WebSocket connection closed');
    this.disconnected.next();
  }

  connectRxjs(token: string) {
    this.rxjsSocket = webSocket({
      url: `wss://localhost:7077/ws/connect?token=${token}`,
      openObserver: { next: () => this.onConnected() },
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
    if (this.rxjsSocket && !this.rxjsSocket.closed) {
      this.rxjsSocket.next(message);
    }
  }

  disconnectRxjs() {
    if (this.rxjsSocket) {
      this.rxjsSocket.complete();
    }
  }

  private reconnectIfNeeded() {
    const storedToken = localStorage.getItem(this.tokenKey);
    if (storedToken) {
      this.connectRxjs(storedToken);
    }
  }
}
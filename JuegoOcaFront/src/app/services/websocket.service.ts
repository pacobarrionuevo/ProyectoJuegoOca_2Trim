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

  private onMessageReceived(message: string) {
    console.log("Dentro de onMessageReceived");
    try {
      console.log('WebSocketService: Mensaje recibido:', message);
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
        
      } else if (parsedMessage.Type === 'activeConnections') {
        console.log(`WebSocketService: Recibido activeConnections. Count recibido: ${parsedMessage.Count}`);
        
        // Actualizar el número de conexiones activas
        this.activeConnections.next(parsedMessage.Count);

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

      } else if (parsedMessage.Type === 'friendConnected' || parsedMessage.Type === 'friendDisconnected') {
        console.log(`WebSocketService: Evento de amigo ${parsedMessage.Type} recibido para el ID: ${parsedMessage.FriendId}`);
        this.messageReceived.next(parsedMessage);

      } else {
        console.log('WebSocketService: Mensaje recibido no manejado:', parsedMessage);
      }
    } catch (error) {
      console.error('Error al parsear el mensaje:', error);
    }
  }

  private onError(error: any) {
    console.error('WebSocketService: Error en la conexión WebSocket:', error);
    // Intentar reconectar después de un error solo si hay un token almacenado
    /*
    const storedToken = sessionStorage.getItem(this.tokenKey);
    if (storedToken) {
      console.log('WebSocketService: Intentando reconectar en 3 segundos...');
      setTimeout(() => this.reconnectIfNeeded(), 3000); // Reintentar después de 3 segundos
    }
    */
  }

  connectRxjs(token: string) {
    console.log('WebSocketService: Conectando WebSocket con token:', token);
  
    // Verificar que el token sea una cadena válida
    if (typeof token !== 'string') {
      console.error('WebSocketService: El token no es una cadena válida:', token);
      return;
    }
  
    // Almacenar el token para reconexiones futuras
    sessionStorage.setItem(this.tokenKey, token);
  
    // Cerrar la conexión existente si hay una
    if (this.rxjsSocket && !this.rxjsSocket.closed) {
      console.log('WebSocketService: Cerrando conexión WebSocket existente...');
      this.disconnectRxjs(); // Cerrar la conexión anterior
    }
  
    // Crear una nueva conexión WebSocket
    this.rxjsSocket = webSocket({
      url: `wss://localhost:7077/ws/connect?token=${token}`,
      openObserver: { next: () => this.onConnected() },
      serializer: (value: string) => value,
      deserializer: (event: MessageEvent) => event.data
    });
  
    // Suscribirse a los mensajes del WebSocket
    this.rxjsSocket.subscribe({
      next: (message: string) => this.onMessageReceived(message),
      error: (error) => this.onError(error),
      complete: () => this.onDisconnected()
    });
  }

  sendRxjs(message: string) {
    if (this.rxjsSocket && !this.rxjsSocket.closed) {
      console.log('WebSocketService: Enviando mensaje:', message);
      this.rxjsSocket.next(message);
    } else {
      console.error('WebSocketService: No se puede enviar el mensaje, WebSocket no está conectado');
    }
  }

  disconnectRxjs() {
    if (this.rxjsSocket) {
      console.log('WebSocketService: Desconectando WebSocket...');
      this.onDisconnected(); // Llamar el evento de desconexión
      this.rxjsSocket.complete(); // Finalizar la conexión      

      this.rxjsSocket.unsubscribe(); // Cerrar la suscripción
    }
  }

  private onDisconnected() {
    console.log('WebSocketService: Desconectado del WebSocket');
    this.disconnected.next(true);
  }

  private reconnectIfNeeded() {
    const storedToken = sessionStorage.getItem(this.tokenKey);
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
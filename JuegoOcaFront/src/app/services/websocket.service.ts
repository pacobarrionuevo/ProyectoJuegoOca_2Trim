import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';

@Injectable({
  providedIn: 'root'
})
export class WebsocketService {
  connected = new Subject<void>(); // Notifica cuando se conecta el WebSocket
  messageReceived = new Subject<any>(); // Notifica cuando se recibe un mensaje
  disconnected = new Subject<void>(); // Notifica cuando se desconecta el WebSocket
  activeConnections = new Subject<number>(); // Notifica el número de conexiones activas

  private tokenKey = 'websocket_token'; // Clave para almacenar el token en sessionStorage
  private rxjsSocket: WebSocketSubject<string>; // Conexión WebSocket

  constructor() {
    this.reconnectIfNeeded(); // Intentar reconectar al iniciar el servicio
  }

  /**
   * Método para manejar la conexión del WebSocket.
   */
  private onConnected() {
    console.log('WebSocketService: Socket connected');
    this.connected.next();
  }

  /**
   * Verifica si el WebSocket está conectado.
   */
  isConnectedRxjs(): boolean {
    const isConnected = this.rxjsSocket && !this.rxjsSocket.closed;
    console.log(`WebSocketService: isConnectedRxjs() -> ${isConnected}`);
    return isConnected;
  }

  /**
   * Conecta el WebSocket usando un token de autenticación.
   */
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
      next: (message: string) => this.handleMessage(message),
      error: (error) => this.onError(error),
      complete: () => this.onDisconnected()
    });
  }

  /**
   * Envía un mensaje a través del WebSocket.
   */
  sendRxjs(message: string) {
    if (this.rxjsSocket && !this.rxjsSocket.closed) {
      console.log('WebSocketService: Enviando mensaje:', message);
      this.rxjsSocket.next(message);
    } else {
      console.error('WebSocketService: No se puede enviar el mensaje, WebSocket no está conectado');
    }
  }

  /**
   * Desconecta el WebSocket.
   */
  disconnectRxjs() {
    if (this.rxjsSocket) {
      console.log('WebSocketService: Desconectando WebSocket...');
      this.onDisconnected(); // Llamar el evento de desconexión
      this.rxjsSocket.complete(); // Finalizar la conexión
      this.rxjsSocket.unsubscribe(); // Cerrar la suscripción
    }
  }

  /**
   * Maneja la desconexión del WebSocket.
   */
  private onDisconnected() {
    console.log('WebSocketService: Desconectado del WebSocket');
    this.disconnected.next();
  }

  /**
   * Maneja los mensajes recibidos del WebSocket.
   */
  private handleMessage(message: string): void {
    try {
      const parsedMessage = JSON.parse(message);
      console.log('WebSocketService: Mensaje recibido:', parsedMessage);

      // Convertir propiedades a camelCase si es necesario
      const normalizedMessage = this.normalizeKeys(parsedMessage);

      // Procesar el mensaje según su tipo
      if (normalizedMessage.type === 'friendInvitation') {
        this.handleFriendInvitation(normalizedMessage);
      } else if (normalizedMessage.type === 'activeConnections') {
        this.handleActiveConnections(normalizedMessage);
      } else if (normalizedMessage.type === 'gameStarted') {
        this.handleGameStarted(normalizedMessage);
      } else if (normalizedMessage.type === 'waitingForOpponent') {
        this.handleWaitingForOpponent(normalizedMessage);
      } else if (normalizedMessage.type === 'friendConnected' || normalizedMessage.type === 'friendDisconnected') {
        this.handleFriendStatus(normalizedMessage);
      } else {
        console.log('WebSocketService: Mensaje recibido no manejado:', normalizedMessage);
      }

      // Notificar a los suscriptores que se ha recibido un mensaje
      this.messageReceived.next(normalizedMessage);
    } catch (error) {
      console.error('Error al parsear el mensaje:', error);
    }
  }

  /**
   * Maneja una invitación de amigo.
   */
  private handleFriendInvitation(message: any) {
    const accept = confirm(`${message.fromUserNickname} te ha invitado a jugar. ¿Aceptas?`);
    if (accept) {
      const response = {
        type: 'acceptInvitation',
        hostId: message.fromUserId
      };
      this.sendRxjs(JSON.stringify(response));
    }
  }

  /**
   * Maneja el número de conexiones activas.
   */
  private handleActiveConnections(message: any) {
    console.log(`WebSocketService: Recibido activeConnections. Count recibido: ${message.count}`);
    this.activeConnections.next(message.count);
  }

  /**
   * Maneja el inicio de un juego.
   */
  private handleGameStarted(message: any) {
    this.messageReceived.next({
      type: 'gameStarted',
      gameId: message.gameId,
      opponent: message.opponent
    });
  }

  /**
   * Maneja la espera de un oponente.
   */
  private handleWaitingForOpponent(message: any) {
    this.messageReceived.next({
      type: 'waitingForOpponent'
    });
  }

  /**
   * Maneja el estado de conexión de un amigo.
   */
  private handleFriendStatus(message: any) {
    console.log(`WebSocketService: Evento de amigo ${message.type} recibido para el ID: ${message.friendId}`);
    this.messageReceived.next(message);
  }

  /**
   * Maneja errores en la conexión WebSocket.
   */
  private onError(error: any) {
    console.error('WebSocketService: Error en la conexión WebSocket:', error);
    this.disconnected.next();
  }

  /**
   * Normaliza las claves de un objeto a camelCase.
   */
  private normalizeKeys(obj: any): any {
    if (typeof obj !== 'object' || obj === null) return obj;

    return Object.keys(obj).reduce((acc: any, key) => {
      const camelKey = key.charAt(0).toLowerCase() + key.slice(1);
      acc[camelKey] = this.normalizeKeys(obj[key]);
      return acc;
    }, {});
  }

  /**
   * Intenta reconectar el WebSocket si hay un token almacenado.
   */
  private reconnectIfNeeded() {
    const storedToken = sessionStorage.getItem(this.tokenKey);
    if (storedToken) {
      console.log('WebSocketService: Reconectando WebSocket con token almacenado');
      this.connectRxjs(storedToken); // Intentar reconectar
    } else {
      console.log('WebSocketService: No hay token almacenado, no se puede reconectar');
    }
  }

  /**
   * Elimina el token almacenado (por ejemplo, al cerrar sesión).
   */
  clearToken() {
    sessionStorage.removeItem(this.tokenKey);
    console.log('WebSocketService: Token eliminado');
  }
}
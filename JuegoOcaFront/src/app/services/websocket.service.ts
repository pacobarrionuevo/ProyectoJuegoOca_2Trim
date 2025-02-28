import { Injectable,NgZone } from '@angular/core';
import { Subject } from 'rxjs';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { HttpClient } from '@angular/common/http';
import {  Observable,BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environment';
import { catchError } from 'rxjs/operators'; 
import { of,map,  } from 'rxjs';
@Injectable({
  providedIn: 'root'
})
export class WebsocketService {
  connected = new Subject<void>(); // Notifica cuando se conecta el WebSocket
  
  messageReceived = new Subject<any>(); // Notifica cuando se recibe un mensaje
  disconnected = new Subject<void>(); // Notifica cuando se desconecta el WebSocket
  activeConnections = new Subject<number>(); // Notifica el número de conexiones activas
  friendNotAvailable = new Subject<string>(); // Notifica cuando un amigo no está disponible
  public onlineUsers$ = new BehaviorSubject<Set<number>>(new Set());
  private tokenKey = 'websocket_token'; // Clave para almacenar el token en sessionStorage
  private rxjsSocket: WebSocketSubject<string>; // Conexión WebSocket
  private baseURL = `${environment.apiUrl}`; 
  constructor(private http: HttpClient, private ngZone: NgZone) {
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
  fetchOnlineUsers(): Observable<number[]> {
    return this.http.get<{ onlineUsers: number[] }>(`${this.baseURL}/ws/online-users`).pipe(
      map(response => Array.isArray(response?.onlineUsers) ? response.onlineUsers : []),
      catchError(() => of([]))
    );
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
    if (message === 'pong' || message === 'ping') {
      console.log(`Heartbeat recibido: ${message}`);
      return;

    }
    try {
    
      const parsedMessage = JSON.parse(message);
      console.log('WebSocketService: Mensaje recibido:', parsedMessage);
  
      // Convertir propiedades a camelCase si es necesario
      const normalizedMessage = this.normalizeKeys(parsedMessage);
  
      // Procesar el mensaje según su tipo
      switch (normalizedMessage.type) {
        case 'friendDisconnected':
          this.handleFriendStatus(normalizedMessage);
          break;
          case 'friendConnected':
            this.addOnlineUser(normalizedMessage.friendId);
            break;
        case 'onlineUsers':
        this.handleOnlineUsers(normalizedMessage);
        break;
        case 'gameReady':
          this.handleGameReady(normalizedMessage);
          break;
    
        case 'friendInvitation':
          this.handleFriendInvitation(normalizedMessage);
         break;
        case 'activeConnections':
          this.handleActiveConnections(normalizedMessage);
          break;
        case 'gameStarted':
          this.handleGameStarted(normalizedMessage);
          break;
          case 'friendListUpdate':
            this.messageReceived.next({ type: 'friendListUpdate' });
            break;
        case 'waitingForOpponent':
          this.handleWaitingForOpponent(normalizedMessage);
          break;
          case 'friendRequest':
            this.messageReceived.next({
              type: 'friendRequest',
              requestId: parsedMessage.requestId,
              senderId: parsedMessage.senderId,
              senderName: parsedMessage.senderName
            });
            break;
            
          case 'friendRequestAccepted':
            this.messageReceived.next({
              type: 'friendRequestAccepted',
              friendId: parsedMessage.friendId,
              friendName: parsedMessage.friendName
            });
            break;
            
          case 'friendRequestRejected':
            this.messageReceived.next({
              type: 'friendRequestRejected',
              friendId: parsedMessage.friendId
            });
            break;
        case 'friendNotAvailable':
          this.friendNotAvailable.next(normalizedMessage.message); // Notificar que el amigo no está disponible
          break;
        default:
          console.log('WebSocketService: Mensaje recibido no manejado:', normalizedMessage);
      }
  
      // Notificar a los suscriptores que se ha recibido un mensaje
      this.messageReceived.next(normalizedMessage);
    } catch (error) {
      console.error('Error procesando mensaje:', error);
    }
  }
  /**
   * Maneja una invitación de amigo.
   */
  private handleFriendInvitation(message: any) {
    const accept = confirm(`${message.fromUserNickname} te ha invitado a jugar. ¿Aceptas?`);
    const response = {
      type: 'acceptInvitation',
      inviterId: message.fromUserId
    };
    this.sendRxjs(JSON.stringify(response));
    
  }
  private handleGameReady(message: any): void {
    // Emitir un evento específico para gameReady
    this.messageReceived.next({
      type: 'gameReady',
      gameId: message.gameId,
      opponentId: message.opponentId,
      isPrivate: message.isPrivate
    });
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

 
  
  // Actualización usando nueva instancia para notificar el cambio
  private addOnlineUser(userId: number): void {
    this.ngZone.run(() => {
      const updated = new Set(this.onlineUsers$.value);
      updated.add(userId);
      this.onlineUsers$.next(updated);
    });
  }

  private removeOnlineUser(userId: number): void {
    this.ngZone.run(() => {
      const updated = new Set(this.onlineUsers$.value);
      updated.delete(userId);
      this.onlineUsers$.next(updated);
    });
  }

  private handleOnlineUsers(message: { users: number[] }): void {
    this.ngZone.run(() => {
      this.onlineUsers$.next(new Set(message.users));
    });
  }

  private normalizeKeys(obj: any): any {
    if (typeof obj !== 'object' || obj === null) return obj;
    return Object.keys(obj).reduce((acc: any, key) => {
      const camelKey = key.charAt(0).toLowerCase() + key.slice(1);
      acc[camelKey] = this.normalizeKeys(obj[key]);
      return acc;
    }, {});
  }

  private reconnectIfNeeded() {
    const storedToken = sessionStorage.getItem(this.tokenKey);
    if (storedToken) {
      console.log('WebSocketService: Reconectando WebSocket con token almacenado');
      this.connectRxjs(storedToken);
    } else {
      console.log('WebSocketService: No hay token almacenado, no se puede reconectar');
    }
  }

  clearToken() {
    sessionStorage.removeItem(this.tokenKey);
    console.log('WebSocketService: Token eliminado');
  }
}
import { Injectable, NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { Subject, BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class WebsocketService {
  /**
   * Emisiones generales de conexión
   */
  connected = new Subject<void>();          // Notifica cuando el WebSocket se conecta
  disconnected = new Subject<void>();       // Notifica cuando el WebSocket se desconecta
  activeConnections = new Subject<number>(); // Notifica el número de conexiones activas
  friendNotAvailable = new Subject<string>(); // Notifica cuando un amigo no está disponible

  /**
   * Emisiones relacionadas con mensajes recibidos
   */
  messageReceived = new Subject<any>();     // Notifica cuando se recibe *cualquier* mensaje

  /**
   * Lista de usuarios en línea
   */
  public onlineUsers$ = new BehaviorSubject<Set<number>>(new Set());

  /**
   * Lógica de juego
   */
  private players: any[] = [];
  private currentPlayer: any = null;
  private diceResult: number | null = null;
  private gameId: string | null = null;

  /**
   * Subject para notificar cambios en el estado del juego
   */
  gameStateUpdated = new Subject<{
    players: any[];
    currentPlayer: any;
    diceResult: number | null;
  }>();

  /**
   * Usuario real (el que se ha logueado) para identificar en la partida
   */
  private currentUser: any = null;

  /**
   * WebSocket
   */
  private rxjsSocket: WebSocketSubject<string>;
  private tokenKey = 'websocket_token';
  private baseURL = environment.apiUrl; // Ajusta si tu endpoint es diferente

  constructor(
    private http: HttpClient,
    private ngZone: NgZone,
    private router: Router
  ) {
    this.reconnectIfNeeded();
  }

  // ========================= MÉTODOS DE CONEXIÓN =========================

  private onConnected() {
    console.log('WebSocketService: Socket connected');
    this.connected.next();
  }

  isConnectedRxjs(): boolean {
    const isConnected = this.rxjsSocket && !this.rxjsSocket.closed;
    console.log(`WebSocketService: isConnectedRxjs() -> ${isConnected}`);
    return isConnected;
  }

  sendRxjs(message: string): void {
    if (this.rxjsSocket && !this.rxjsSocket.closed) {
      console.log('WebSocketService: Enviando mensaje:', message);
      this.rxjsSocket.next(message);
    } else {
      console.error('WebSocketService: No se puede enviar el mensaje, WebSocket no está conectado');
    }
  }
  connectRxjs(token: string): void {
    console.log('WebSocketService: Conectando WebSocket con token:', token);
    if (typeof token !== 'string') {
      console.error('WebSocketService: El token no es una cadena válida:', token);
      return;
    }

    sessionStorage.setItem(this.tokenKey, token);

    if (this.rxjsSocket && !this.rxjsSocket.closed) {
      console.log('WebSocketService: Cerrando conexión WebSocket existente...');
      this.disconnectRxjs();
    }

    this.rxjsSocket = webSocket({
      url: `wss://localhost:7077/ws/connect?token=${token}`, // Ajusta si tu endpoint es otro
      openObserver: { next: () => this.onConnected() },
      serializer: (value: string) => value,
      deserializer: (event: MessageEvent) => event.data
    });

    this.rxjsSocket.subscribe({
      next: (message: string) => this.handleMessage(message),
      error: (error) => this.onError(error),
      complete: () => this.onDisconnected()
    });
  }

  disconnectRxjs(): void {
    if (this.rxjsSocket) {
      console.log('WebSocketService: Desconectando WebSocket...');
      this.onDisconnected();
      this.rxjsSocket.complete();
      this.rxjsSocket.unsubscribe();
    }
  }

  private onDisconnected() {
    console.log('WebSocketService: Desconectado del WebSocket');
    this.disconnected.next();
  }

  clearToken(): void {
    sessionStorage.removeItem(this.tokenKey);
    console.log('WebSocketService: Token eliminado');
  }

  // ========================= MÉTODOS HTTP (USUARIOS ONLINE) =========================

  fetchOnlineUsers(): Observable<number[]> {
    return this.http.get<{ onlineUsers: number[] }>(`${this.baseURL}/ws/online-users`).pipe(
      map(response => Array.isArray(response?.onlineUsers) ? response.onlineUsers : []),
      catchError(() => of([]))
    );
  }

  // ========================= MÉTODOS DE JUEGO =========================

  /**
   * Inicia una partida en el backend. Retorna un Observable con la respuesta.
   * Se usa en GameComponent para: this.websocketService.startGame('12345', playerName).subscribe(...)
   */
  startGame(gameId: string, playerName: string): Observable<any> {
    this.gameId = gameId; // Asignar el ID de la partida
    const body = { GameId: gameId, PlayerName: playerName };

    return this.http.post<any>(`${this.baseURL}/api/Game/start-game`, body).pipe(
      catchError((error) => {
        console.error('Error al iniciar la partida:', error);
        return of(null);
      })
    );
  }

  /**
   * Envía el mensaje "rollDice" al backend para tirar el dado.
   * Se llama desde GameComponent cuando el jugador hace clic en "Lanzar dado".
   */
  rollDice(): void {
    if (!this.currentPlayer) {
      console.warn('No hay jugador actual definido para lanzar el dado.');
      return;
    }
    console.log('Solicitando tirada de dado al servidor...');
    console.log('Game ID:', this.gameId);
    console.log('Jugador actual:', this.currentPlayer);

    const message = {
      type: 'rollDice',
      gameId: this.gameId,
      playerId: this.currentPlayer.id
    };
    this.sendRxjs(JSON.stringify(message));
  }

  /**
   * Almacena en el servicio quién es el usuario real que está jugando (no el Bot).
   */
  setCurrentUser(user: any): void {
    console.log('Estableciendo usuario real en WebsocketService:', user);
    this.currentUser = user;
  }

  getCurrentUser(): any {
    return this.currentUser;
  }

  /**
   * Almacena quién es el jugador actual (turno actual).
   */
  setCurrentPlayer(player: any): void {
    console.log('Jugador actual actualizado en WebsocketService:', player);
    this.currentPlayer = player;
  }

  getDiceResult(): number | null {
    return this.diceResult;
  }

  // ========================= LÓGICA PARA PROCESAR MENSAJES RECIBIDOS =========================

  private handleMessage(message: string): void {
    // Heartbeat
    if (message === 'pong' || message === 'ping') {
      console.log(`Heartbeat recibido: ${message}`);
      return;
    }

    try {
      const parsedMessage = JSON.parse(message);
      console.log('WebSocketService: Mensaje recibido:', parsedMessage);

      // Dependiendo del tipo de mensaje, hacemos algo específico
      switch (parsedMessage.type) {
        // ----------- Amigos / Usuarios -----------
        case 'friendConnected':
          this.addOnlineUser(parsedMessage.friendId);
          break;
        case 'friendDisconnected':
          this.removeOnlineUser(parsedMessage.friendId);
          break;
        case 'onlineUsers':
          this.handleOnlineUsers(parsedMessage);
          break;
        case 'friendInvitation':
          this.handleFriendInvitation(parsedMessage);
          break;
        case 'friendRequest':
        case 'friendRequestAccepted':
        case 'friendRequestRejected':
        case 'friendListUpdate':
          // Podrías manejar notificaciones de amistad aquí
          break;
        case 'friendNotAvailable':
          this.friendNotAvailable.next(parsedMessage.message);
          break;
        case 'activeConnections':
          this.handleActiveConnections(parsedMessage);
          break;

        // ----------- Juego -----------
        case 'skipTurn':
          // Este lo reenvías a messageReceived para que GameComponent lo maneje
          this.messageReceived.next(parsedMessage);
          break;

        case 'moveResult':
          // Reenviamos para que el GameComponent muestre la animación o mensaje
          this.messageReceived.next(parsedMessage);
          break;

        case 'gameOver':
          // Notificar al GameComponent que la partida terminó
          this.messageReceived.next(parsedMessage);
          break;

        case 'gameUpdate':
          // Actualizar players, currentPlayer, diceResult
          this.handleGameUpdate(parsedMessage);
          break;

        case 'gameReady':
          // Partida lista para dos jugadores
          this.messageReceived.next(parsedMessage);
          break;

        case 'waitingForOpponent':
          this.messageReceived.next(parsedMessage);
          break;

        case 'gameStarted':
          // Notificar si deseas manejar "la partida ha empezado"
          this.messageReceived.next(parsedMessage);
          break;

        // Por defecto, no manejado
        default:
          console.log('WebSocketService: Mensaje no manejado:', parsedMessage);
      }

      // En cualquier caso, notificar a messageReceived
      this.messageReceived.next(parsedMessage);
    } catch (error) {
      console.error('Error procesando mensaje:', error);
    }
  }

  /**
   * Actualiza el estado del juego (players, currentPlayer, diceResult) y notifica a los suscriptores.
   */
  private handleGameUpdate(message: any): void {
    console.log('WebSocketService: Actualización del estado del juego recibida:', message);

    // players
    if (message.players) {
      const playersArray = Array.isArray(message.players)
        ? message.players
        : Object.values(message.players);
      this.players = playersArray.map((player: any) => ({
        ...player
      }));
      console.log('Jugadores actualizados en WebsocketService:', this.players);
    }

    // currentPlayer
    if (message.currentPlayer) {
      this.currentPlayer = { ...message.currentPlayer };
      console.log('Jugador actual actualizado en WebsocketService:', this.currentPlayer);
    }

    // diceResult
    if (message.diceResult !== undefined) {
      this.diceResult = message.diceResult;
      console.log('Resultado del dado actualizado en WebsocketService:', this.diceResult);
    }

    // Notificar a los suscriptores que el estado del juego cambió
    this.notifyGameStateUpdate();
  }

  private notifyGameStateUpdate(): void {
    this.gameStateUpdated.next({
      players: this.players,
      currentPlayer: this.currentPlayer,
      diceResult: this.diceResult
    });
  }

  /**
   * Maneja la invitación de amigo (si se quiere un confirm, etc.)
   * En este ejemplo, respondemos automáticamente con 'acceptInvitation'.
   */
  private handleFriendInvitation(message: any): void {
    console.log('Invitación recibida de:', message.fromUserNickname);
    // Podrías poner un confirm(...) para aceptar o rechazar
    // Por ahora, aceptamos de inmediato:
    const response = {
      type: 'acceptInvitation',
      inviterId: message.fromUserId
    };
    this.sendRxjs(JSON.stringify(response));
  }

  private handleActiveConnections(parsedMessage: any) {
    console.log(`WebSocketService: Recibido activeConnections. Count: ${parsedMessage.count}`);
    this.activeConnections.next(parsedMessage.count);
  }

  private onError(error: any) {
    console.error('WebSocketService: Error en la conexión WebSocket:', error);
    this.disconnected.next();
  }

  // ========================= MANEJO DE USUARIOS ONLINE =========================

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

  // ========================= RECONEXIÓN =========================

  private reconnectIfNeeded(): void {
    const storedToken = sessionStorage.getItem(this.tokenKey);
    if (storedToken) {
      console.log('WebSocketService: Reconectando WebSocket con token almacenado');
      this.connectRxjs(storedToken);
    } else {
      console.log('WebSocketService: No hay token almacenado, no se puede reconectar');
    }
  }
}

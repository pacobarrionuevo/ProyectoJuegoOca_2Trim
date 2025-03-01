import { Injectable, NgZone } from '@angular/core';
import { Subject, Observable, BehaviorSubject, of } from 'rxjs';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { catchError, map } from 'rxjs/operators';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class WebsocketService {
  // Notificaciones generales de conexión
  connected = new Subject<void>();            // Notifica cuando se conecta el WebSocket
  messageReceived = new Subject<any>();         // Notifica cuando se recibe un mensaje
  disconnected = new Subject<void>();           // Notifica cuando se desconecta el WebSocket
  activeConnections = new Subject<number>();    // Notifica el número de conexiones activas
  friendNotAvailable = new Subject<string>();     // Notifica cuando un amigo no está disponible

  // Usuarios en línea (observable que emite un Set de IDs)
  public onlineUsers$ = new BehaviorSubject<Set<number>>(new Set());

  // Clave y socket
  private tokenKey = 'websocket_token';           // Clave para almacenar el token en sessionStorage
  private rxjsSocket: WebSocketSubject<string>;   // Conexión WebSocket
  private baseURL = `${environment.apiUrl}`;

  // ============================= LÓGICA DEL JUEGO =============================
  private players: any[] = [];                      // Lista de jugadores en la partida
  private currentPlayer: any = null;                // Jugador actual
  private gameId: string | null = null;             // ID de la partida actual
  private diceResult: number | null = null;         // Resultado del dado

  // Para almacenar el usuario real (opcional)
  private currentUser: any = null;

  // Subject para notificar actualizaciones en el estado del juego
  gameStateUpdated = new Subject<{ players: any[], currentPlayer: any, diceResult: number | null }>();

  constructor(private http: HttpClient, private ngZone: NgZone, private router: Router) {
    this.reconnectIfNeeded(); // Intentar reconectar si hay token almacenado
  }

  // ==================== MÉTODOS DE CONEXIÓN Y COMUNICACIÓN ====================

  private onConnected(): void {
    console.log('WebSocketService: Socket connected');
    this.connected.next();
  }

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

  connectRxjs(token: string): void {
    console.log('WebSocketService: Conectando WebSocket con token:', token);

    if (typeof token !== 'string') {
      console.error('WebSocketService: El token no es una cadena válida:', token);
      return;
    }

    // Almacenar token para reconexiones futuras
    sessionStorage.setItem(this.tokenKey, token);

    // Cerrar conexión existente si es necesario
    if (this.rxjsSocket && !this.rxjsSocket.closed) {
      console.log('WebSocketService: Cerrando conexión WebSocket existente...');
      this.disconnectRxjs();
    }

    // Crear nueva conexión WebSocket
    this.rxjsSocket = webSocket({
      url: `wss://localhost:7077/ws/connect?token=${token}`,
      openObserver: { next: () => this.onConnected() },
      serializer: (value: string) => value,
      deserializer: (event: MessageEvent) => event.data
    });

    // Suscribirse a los mensajes entrantes
    this.rxjsSocket.subscribe({
      next: (message: string) => this.handleMessage(message),
      error: (error) => this.onError(error),
      complete: () => this.onDisconnected()
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
      this.onDisconnected();
      this.rxjsSocket.complete();
      this.rxjsSocket.unsubscribe();
    }
  }

  private onDisconnected(): void {
    console.log('WebSocketService: Desconectado del WebSocket');
    this.disconnected.next();
  }

  // ==================== MÉTODOS DE JUEGO ====================

  startGame(gameId: string, playerName: string): Observable<any> {
    this.gameId = gameId;
    const body = { GameId: gameId, PlayerName: playerName };
    return this.http.post<any>(`${environment.apiUrl}/api/Game/start-game`, body).pipe(
      catchError((error) => {
        console.error('Error al iniciar la partida:', error);
        return of(null);
      })
    );
  }

  getPlayers(): Observable<any[]> {
    console.log('Obteniendo jugadores desde el servidor...');
    return this.http.get<any[]>(`${environment.apiUrl}/api/Game/players`).pipe(
      catchError((error) => {
        console.error('Error al obtener los jugadores:', error);
        return of([]);
      })
    );
  }

  setCurrentUser(user: any): void {
    console.log('Estableciendo usuario real:', user);
    this.currentUser = user;
  }

  getCurrentUser(): any {
    return this.currentUser;
  }

  setCurrentPlayer(player: any): void {
    this.currentPlayer = player;
    console.log('Jugador actual actualizado en el servicio:', this.currentPlayer);
  }

  getDiceResult(): number | null {
    return this.diceResult;
  }

  rollDice(): void {
    console.log('Solicitando tirada de dado al servidor...');
    console.log('Game ID:', this.gameId);
    console.log('Jugador actual:', this.currentPlayer);
    this.sendRxjs(JSON.stringify({
      type: 'rollDice',
      gameId: this.gameId,
      playerId: this.currentPlayer?.id
    }));
  }

  private notifyGameStateUpdate(): void {
    console.log('Notificando actualización del estado del juego...');
    console.log('Jugadores actuales:', this.players);
    console.log('Jugador actual:', this.currentPlayer);
    console.log('Resultado del dado:', this.diceResult);
    this.gameStateUpdated.next({
      players: this.players,
      currentPlayer: this.currentPlayer,
      diceResult: this.diceResult
    });
  }

  private handleGameOver(message: any): void {
    console.log('Juego terminado. Resultados:', message);
    alert(`El juego ha terminado. El ganador es: ${message.winnerName}`);
    // Redirigir a la vista de matchmaking o donde corresponda
    this.router.navigate(['/matchmaking']);
  }

  // ==================== MANEJO DE MENSAJES ====================

  private handleMessage(message: string): void {
    // Si se trata de un heartbeat, simplemente retornar
    if (message === 'pong' || message === 'ping') {
      console.log(`Heartbeat recibido: ${message}`);
      return;
    }
    try {
      const parsedMessage = JSON.parse(message);
      console.log('WebSocketService: Mensaje recibido:', parsedMessage);
      const normalizedMessage = this.normalizeKeys(parsedMessage);

      // Procesar según el tipo de mensaje
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
          // Notificar a los suscriptores que la partida está lista
          this.messageReceived.next({
            type: 'gameReady',
            gameId: normalizedMessage.gameId,
            opponentId: normalizedMessage.opponentId,
            isPrivate: normalizedMessage.isPrivate
          });
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
        case 'waitingForOpponent':
          this.handleWaitingForOpponent(normalizedMessage);
          break;
        case 'friendListUpdate':
          this.messageReceived.next({ type: 'friendListUpdate' });
          break;
        case 'friendRequest':
          this.messageReceived.next({
            type: 'friendRequest',
            requestId: normalizedMessage.requestId,
            senderId: normalizedMessage.senderId,
            senderName: normalizedMessage.senderName
          });
          break;
        case 'friendRequestAccepted':
          this.messageReceived.next({
            type: 'friendRequestAccepted',
            friendId: normalizedMessage.friendId,
            friendName: normalizedMessage.friendName
          });
          break;
        case 'friendRequestRejected':
          this.messageReceived.next({
            type: 'friendRequestRejected',
            friendId: normalizedMessage.friendId
          });
          break;
        case 'friendNotAvailable':
          this.friendNotAvailable.next(normalizedMessage.message);
          break;
        case 'gameUpdate':
          this.handleGameUpdate(normalizedMessage);
          break;
        case 'playerJoined':
          this.handlePlayerJoined(normalizedMessage);
          break;
        case 'botMove':
          this.handleBotMove(normalizedMessage);
          break;
        case 'gameOver':
          this.handleGameOver(normalizedMessage);
          break;
        case 'moveResult':
          this.handleMoveResult(normalizedMessage);
          break;
        case 'skipTurn':
          this.handleSkipTurn(normalizedMessage);
          break;
        default:
          console.log('WebSocketService: Mensaje recibido no manejado:', normalizedMessage);
      }

      // Notificar a los suscriptores generales
      this.messageReceived.next(normalizedMessage);
    } catch (error) {
      console.error('Error procesando mensaje:', error);
    }
  }

  private handleSkipTurn(message: any): void {
    console.log('Turno perdido:', message);
    this.messageReceived.next({
      type: 'skipTurn',
      playerName: message.playerName,
      turnsToSkip: message.turnsToSkip
    });
  }

  private handleMoveResult(message: any): void {
    console.log('Resultado del movimiento:', message);
    this.messageReceived.next({
      type: 'moveResult',
      playerName: message.playerName,
      diceResult: message.diceResult,
      newPosition: message.newPosition,
      cellType: message.cellType,
      specialMessage: message.specialMessage
    });
  }

  private handleGameUpdate(message: any): void {
    console.log('WebSocketService: Actualización del estado del juego recibida:', message);
    if (message.players) {
      console.log('Jugadores recibidos:', message.players);
      const playersArray = Array.isArray(message.players)
        ? message.players
        : Object.values(message.players);
      this.players = playersArray.map((player: any) => ({
        ...player,
        isMoving: false,
        targetPosition: player.position
      }));
      console.log('Jugadores actualizados:', this.players);
    } else {
      console.warn('No se recibieron jugadores en la actualización del juego.');
    }
    if (message.currentPlayer) {
      console.log('Jugador actual recibido:', message.currentPlayer);
      this.currentPlayer = message.currentPlayer;
      console.log('Jugador actual actualizado:', this.currentPlayer);
    } else {
      console.warn('No se recibió el jugador actual en la actualización del juego.');
    }
    if (message.diceResult !== undefined) {
      console.log('Resultado del dado recibido:', message.diceResult);
      this.diceResult = message.diceResult;
      console.log('Resultado del dado actualizado:', this.diceResult);
    } else {
      console.warn('No se recibió el resultado del dado en la actualización del juego.');
    }
    this.notifyGameStateUpdate();
  }

  private handlePlayerJoined(message: any): void {
    console.log('WebSocketService: Jugador unido:', message);
    this.players = message.players;
    this.notifyGameStateUpdate();
  }

  private handleBotMove(message: any): void {
    console.log('WebSocketService: Movimiento del bot:', message);
    const bot = this.players.find(player => player.id === message.playerId);
    if (bot) {
      bot.position = message.newPosition;
    }
    this.notifyGameStateUpdate();
  }

  private handleFriendInvitation(message: any): void {
    // Se muestra un confirm para aceptar la invitación
    const accept = confirm(`${message.fromUserNickname} te ha invitado a jugar. ¿Aceptas?`);
    if (accept) {
      // Enviar respuesta; usa la propiedad inviterId para que el backend la procese correctamente
      const response = {
        type: 'acceptInvitation',
        inviterId: message.fromUserId
      };
      this.sendRxjs(JSON.stringify(response));
    }
  }

  private handleActiveConnections(message: any): void {
    console.log(`WebSocketService: Recibido activeConnections. Count recibido: ${message.count}`);
    this.activeConnections.next(message.count);
  }

  private handleGameStarted(message: any): void {
    this.messageReceived.next({
      type: 'gameStarted',
      gameId: message.gameId,
      opponent: message.opponent
    });
  }

  private handleWaitingForOpponent(message: any): void {
    this.messageReceived.next({
      type: 'waitingForOpponent'
    });
  }

  private handleFriendStatus(message: any): void {
    console.log(`WebSocketService: Evento de amigo ${message.type} recibido para el ID: ${message.friendId}`);
    this.messageReceived.next(message);
  }

  private onError(error: any): void {
    console.error('WebSocketService: Error en la conexión WebSocket:', error);
    this.disconnected.next();
  }

  // ==================== UTILIDADES Y RECONEXIÓN ====================

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

  private reconnectIfNeeded(): void {
    const storedToken = sessionStorage.getItem(this.tokenKey);
    if (storedToken) {
      console.log('WebSocketService: Reconectando WebSocket con token almacenado');
      this.connectRxjs(storedToken);
    } else {
      console.log('WebSocketService: No hay token almacenado, no se puede reconectar');
    }
  }

  clearToken(): void {
    sessionStorage.removeItem(this.tokenKey);
    console.log('WebSocketService: Token eliminado');
  }
}

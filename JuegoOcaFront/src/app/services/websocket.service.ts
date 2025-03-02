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

  // Variables para gestionar la conexión, si se ha recibido el mensaje, si se ha desconectado o si hay alguna conexión activa
  connected = new Subject<void>(); 
  messageReceived = new Subject<any>();
  disconnected = new Subject<void>();
  activeConnections = new Subject<number>();

  friendNotAvailable = new Subject<string>();
  public onlineUsers$ = new BehaviorSubject<Set<number>>(new Set());

  // Clave para almacenar el token en sessionStorage
  private tokenKey = 'websocket_token'; 

  // Conexion ws
  private rxjsSocket: WebSocketSubject<string>;

  private baseURL = environment.apiUrl;

  // Variables para listaJugadores, usuario actual, jugador actual(no son lo mismo) (turnos, tal), id de la partida y resultado del dado
  private players: any[] = [];
  private currentPlayer: any = null;
  private currentUser: any = null;  
  private gameId: string | null = null; 
  private diceResult: number | null = null; 

  // Guarda los mensajes que se van enviando por el chat
  messages: string[] = [];

  // Se encarga de notificar cambios en el estado del juego
  gameStateUpdated = new Subject<{ players: any[], currentPlayer: any, diceResult: number | null }>();

  constructor(private http: HttpClient, private router: Router, private ngZone: NgZone) {
    // Imaginando que fallase la conexión, este método intenta reconectar al iniciar el servicio
    this.reconnectIfNeeded(); 
  }

  // Método para asegurar la conexión del websocket
  private onConnected() {
    console.log('WebSocketService: Socket connected');
    this.connected.next();
  }

  // Verifica si el websocket está conectado.
  isConnectedRxjs(): boolean {
    const isConnected = this.rxjsSocket && !this.rxjsSocket.closed;
    console.log(`WebSocketService: isConnectedRxjs() -> ${isConnected}`);
    return isConnected;
  }

  // Conecta el websocket usando el token de autenticación del usuario que inició sesión.
  connectRxjs(token: string) {
    console.log('WebSocketService: Conectando WebSocket con token:', token);

    // Verificar que el token sea una cadena válida
    if (typeof token !== 'string') {
      console.error('WebSocketService: El token no es una cadena válida:', token);
      return;
    }

    // Almacenar el token para reconexiones futuras --> recargas de páginas
    sessionStorage.setItem(this.tokenKey, token);

    // Cerrar la conexión existente si hay una
    if (this.rxjsSocket && !this.rxjsSocket.closed) {
      console.log('WebSocketService: Cerrando conexión WebSocket existente...');
      this.disconnectRxjs();
    }

    // Crear una nueva conexión websocket (ou que trabajito)
    this.rxjsSocket = webSocket({
      // Llamada al controlador del servidor
      url: `wss://localhost:7077/ws/connect?token=${token}`,
      openObserver: { next: () => this.onConnected() },
      serializer: (value: string) => value,
      deserializer: (event: MessageEvent) => event.data
    });

    // Suscribirse a los mensajes del websocket
    this.rxjsSocket.subscribe({
      next: (message: string) => this.handleMessage(message),
      error: (error) => this.onError(error),
      complete: () => this.onDisconnected()
    });
  }

  // Envía un mensaje a través del websocket
  sendRxjs(message: string) {
    if (this.rxjsSocket && !this.rxjsSocket.closed) {
      console.log('WebSocketService: Enviando mensaje:', message);
      this.rxjsSocket.next(message);
    } else {
      console.error('WebSocketService: No se puede enviar el mensaje, WebSocket no está conectado');
    }
  }

  // Desconecta el websocket
  disconnectRxjs() {
    if (this.rxjsSocket) {
      console.log('WebSocketService: Desconectando WebSocket...');
      this.onDisconnected(); 
      this.rxjsSocket.complete();
      this.rxjsSocket.unsubscribe();
    }
  }

  // Muestra que se ha desconectado el websocket
  private onDisconnected() {
    console.log('WebSocketService: Desconectado del WebSocket');
    this.disconnected.next();
  }

  // Método que llama al endpoint del servidor para empezar el juego
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

  // Obtiene la lista de jugadores que hay dentro de una partida
  getPlayers(): Observable<any[]> {
    console.log('Obteniendo jugadores desde el servidor...');
    return this.http.get<any[]>(`${environment.apiUrl}/api/Game/players`).pipe(
      catchError((error) => {
        // Si hay error recogiendo los datos de los jugadores, muestra una lista vacía
        console.error('Error al obtener los jugadores:', error);
        return of([]);
      })
    );
  }

  fetchOnlineUsers(): Observable<number[]> {
    return this.http.get<{ onlineUsers: number[] }>(`${this.baseURL}/ws/online-users`).pipe(
      map(response => Array.isArray(response?.onlineUsers) ? response.onlineUsers : []),
      catchError(() => of([]))
    );
  }

  // Establece el usuario real cuando se une a la partida
  setCurrentUser(user: any): void {
    console.log('Estableciendo usuario real:', user);
    this.currentUser = user;
  }

  // Método para obtener al usuario real
  getCurrentUser(): any {
    return this.currentUser;
  }

  // Actualizar el jugador en el servicio
  setCurrentPlayer(player: any): void {
    console.log('Jugador actual actualizado en WebsocketService:', player);
    this.currentPlayer = player;
  }

  // Método para obtener el resultado del dado
  getDiceResult(): number | null {
    return this.diceResult;
  }

  //Método para lanzar los dados y mover al jugador
  rollDice(): void {
    console.log('Solicitando tirada de dado al servidor...');
    console.log('Game ID:', this.gameId);
    console.log('Jugador actual:', this.currentPlayer);
    this.sendRxjs(JSON.stringify({
        type: 'rollDice',
        gameId: this.gameId,
        playerId: this.currentPlayer.id
    }));
  }

  // Notifica a los suscriptores que el estado del juego ha cambiado
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

  // Maneja el fin de la partida
  private handleGameOver(message: any): void {
    console.log('Juego terminado. Resultados:', message);
    alert(`El juego ha terminado. El ganador es: ${message.winnerName}`);
    this.router.navigate(['/matchmaking']);
}

// Maneja todos los posibles mensajes recibidos del websockets
private handleMessage(message: string): void {
  try {
      // Ignorar mensajes "ping" y "pong"
      if (message === 'ping' || message === 'pong') {
          console.log('WebSocketService: Mensaje de keep-alive recibido:', message);
          return;
      }

      // Intentar parsear el mensaje como JSON
      const parsedMessage = JSON.parse(message);
      console.log('WebSocketService: Mensaje recibido:', parsedMessage);

      // Convertir propiedades a camelCase si es necesario
      const normalizedMessage = this.normalizeKeys(parsedMessage);

      // Procesar el mensaje según su tipo
      if (normalizedMessage.type === 'chatMessage') {
          this.messageReceived.next(normalizedMessage);
      } else if (normalizedMessage.type === 'friendInvitation') {
          this.handleFriendInvitation(normalizedMessage);
      } else if (normalizedMessage.type === 'activeConnections') {
          this.handleActiveConnections(normalizedMessage);
      } else if (normalizedMessage.type === 'gameStarted') {
          this.handleGameStarted(normalizedMessage);
      } else if (normalizedMessage.type === 'waitingForOpponent') {
          this.handleWaitingForOpponent(normalizedMessage);
      } else if (normalizedMessage.type === 'friendConnected') {
          this.addOnlineUser(normalizedMessage.friendId); // Añadir usuario conectado
      } else if (normalizedMessage.type === 'friendDisconnected') {
          this.removeOnlineUser(normalizedMessage.friendId); // Eliminar usuario desconectado
      } else if (normalizedMessage.type === 'onlineUsers') {
          this.handleOnlineUsers(normalizedMessage); // Manejar lista de usuarios en línea
      } else if (normalizedMessage.type === 'friendRequest') {
          // Manejar solicitud de amistad
          console.log('Solicitud de amistad recibida:', normalizedMessage);
          this.messageReceived.next(normalizedMessage);
      } else if (normalizedMessage.type === 'friendRequestAccepted') {
          // Manejar aceptación de solicitud de amistad
          console.log('Solicitud de amistad aceptada:', normalizedMessage);
          this.messageReceived.next(normalizedMessage);
      } else if (normalizedMessage.type === 'friendRequestRejected') {
          // Manejar rechazo de solicitud de amistad
          console.log('Solicitud de amistad rechazada:', normalizedMessage);
          this.messageReceived.next(normalizedMessage);
      } else if (normalizedMessage.type === 'friendListUpdate') {
          // Manejar actualización de la lista de amigos
          console.log('Lista de amigos actualizada:', normalizedMessage);
          this.messageReceived.next(normalizedMessage);
      } else if (normalizedMessage.type === 'friendNotAvailable') {
          // Manejar amigo no disponible
          console.log('Amigo no disponible:', normalizedMessage.message);
          this.friendNotAvailable.next(normalizedMessage.message);
      } else if (normalizedMessage.type === 'gameUpdate') {
          this.handleGameUpdate(normalizedMessage);
      } else if (normalizedMessage.type === 'playerJoined') {
          this.handlePlayerJoined(normalizedMessage);
      } else if (normalizedMessage.type === 'botMove') {
          this.handleBotMove(normalizedMessage);
      } else if (normalizedMessage.type === 'gameOver') {
          this.handleGameOver(normalizedMessage);
      } else if (normalizedMessage.type === 'moveResult') {
          this.handleMoveResult(normalizedMessage);
      } else if (normalizedMessage.type === 'skipTurn') {
          this.handleSkipTurn(normalizedMessage);
      } else {
          console.log('WebSocketService: Mensaje recibido no manejado:', normalizedMessage);
      }
  } catch (error) {
      console.error('Error al parsear el mensaje:', error);
  }
}

// Manejar que se salte un turno
private handleSkipTurn(message: any): void {
    console.log('Turno perdido:', message);
    this.messageReceived.next({
        type: 'skipTurn',
        playerName: message.playerName,
        turnsToSkip: message.turnsToSkip
    });
}

// Manejar el mensaje que salta al hacer una tirada
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

  // Maneja la actualización del estado del juego
  private handleGameUpdate(message: any): void {
    console.log('WebSocketService: Actualización del estado del juego recibida:', message);
  
    if (message.players) {
      console.log('Jugadores recibidos:', message.players);
  
      // Convierte a los jugadores en un arreglo si es un objeto para que se puedan leer bien
      const playersArray = Array.isArray(message.players) 
        ? message.players 
        : Object.values(message.players);
  
      this.players = playersArray.map((player: any) => ({
        ...player,
        isMoving: false,
        targetPosition: player.position,
      }));
      console.log('Jugadores actualizados en WebsocketService:', this.players);
    }
  
    // Verifica si el jugador actual está en el mensaje
    if (message.currentPlayer) {
      this.currentPlayer = { ...message.currentPlayer };
      console.log('Jugador actual actualizado en WebsocketService:', this.currentPlayer);
    }
  
    // Verifica si el resultado del dado está en el mensaje
    if (message.diceResult !== undefined) {
      this.diceResult = message.diceResult;
      console.log('Resultado del dado actualizado en WebsocketService:', this.diceResult);
    }
  
    // Notifica a los suscriptores que el estado del juego ha cambiado
    this.notifyGameStateUpdate();
  }

  // Maneja la entrada de un nuevo jugador
  private handlePlayerJoined(message: any): void {
      console.log('WebSocketService: Jugador unido:', message);
      this.players = message.players;
      this.notifyGameStateUpdate();
  }

  // Maneja el movimiento automático del bot
  private handleBotMove(message: any): void {
      console.log('WebSocketService: Movimiento del bot:', message);
      const bot = this.players.find(player => player.id === message.playerId);
      if (bot) {
          bot.position = message.newPosition;
      }
      this.notifyGameStateUpdate();
  }


  // Maneja una invitación de amigo
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

  // Maneja el número de conexiones activas

  private handleActiveConnections(message: any) {
    console.log(`WebSocketService: Recibido activeConnections. Count recibido: ${message.count}`);
    this.activeConnections.next(message.count);
  }

  // Maneja el inicio de la partida
  private handleGameStarted(message: any): void {
    console.log('WebSocketService: Partida iniciada:', message);
  
    if (message.players) {
      this.players = message.players;
      this.currentPlayer = this.players[0]; 
      this.notifyGameStateUpdate();
    }
  
    this.messageReceived.next({
      type: 'gameStarted',
      gameId: message.gameId,
      players: message.players
    });
  }

  // Maneja la espera de un oponente
  private handleWaitingForOpponent(message: any) {
    this.messageReceived.next({
      type: 'waitingForOpponent'
    });
  }

  // Maneja el estado de conexión de un amigo
  private handleFriendStatus(message: any) {
    console.log(`WebSocketService: Evento de amigo ${message.type} recibido para el ID: ${message.friendId}`);
    this.messageReceived.next(message);
  }

  // Maneja errores en la conexión websocket
  private onError(error: any) {
    console.error('WebSocketService: Error en la conexión WebSocket:', error);
    this.disconnected.next();
  }

  // Normaliza las claves de un objeto a camelCase
  private normalizeKeys(obj: any): any {
    if (typeof obj !== 'object' || obj === null) return obj;
  }

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

  // Intenta reconectar el websocket si hay un token almacenado
  private reconnectIfNeeded(): void {
    const storedToken = sessionStorage.getItem(this.tokenKey);
    if (storedToken) {
      console.log('WebSocketService: Reconectando WebSocket con token almacenado');
      this.connectRxjs(storedToken);
    } else {
      console.log('WebSocketService: No hay token almacenado, no se puede reconectar');
    }
  }

  // Elimina el token almacenado (por ejemplo, al cerrar sesión)
  clearToken() {
    sessionStorage.removeItem(this.tokenKey);
    console.log('WebSocketService: Token eliminado');
  }
}

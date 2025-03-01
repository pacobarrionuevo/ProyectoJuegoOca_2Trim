import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';
import { of } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { map, catchError } from 'rxjs/operators'; 
import { Router } from '@angular/router';

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

  // ===================================================================================================
  // PARTE DEL CÓDIGO RELACIONADA CON EL JUEGO
  private players: any[] = []; // Lista de jugadores
  private currentPlayer: any = null; // Jugador actual
  private gameId: string | null = null; // ID de la partida
  private diceResult: number | null = null; // Resultado del dado

  messages: string[] = [];

  // Subject para notificar cambios en el estado del juego
  gameStateUpdated = new Subject<{ players: any[], currentPlayer: any, diceResult: number | null }>();

  // ===================================================================================================

  constructor(private http: HttpClient, private router: Router) {
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

  // ===================================================================================================
  startGame(gameId: string, playerName: string): Observable<any> {
    this.gameId = gameId; // Asignar el gameId al servicio
    const body = { GameId: gameId, PlayerName: playerName };
    return this.http.post<any>(`${environment.apiUrl}/api/Game/start-game`, body).pipe(
        catchError((error) => {
            console.error('Error al iniciar la partida:', error);
            return of(null);
        })
    );
  }

  /**
   * Obtiene la lista de jugadores.
   */
  getPlayers(): Observable<any[]> {
    console.log('Obteniendo jugadores desde el servidor...');
    return this.http.get<any[]>(`${environment.apiUrl}/api/Game/players`).pipe(
      catchError((error) => {
        console.error('Error al obtener los jugadores:', error);
        return of([]); // Devuelve una lista vacía en caso de error
      })
    );
  }

  private currentUser: any = null; // Almacena el usuario real

  /**
   * Establece el usuario real cuando se une a la partida.
   */
  setCurrentUser(user: any): void {
    console.log('Estableciendo usuario real:', user);
    this.currentUser = user;
  }

  /**
   * Obtiene el usuario real.
   */
  getCurrentUser(): any {
    return this.currentUser;
  }

  setCurrentPlayer(player: any): void {
    this.currentPlayer = player;
    console.log('Jugador actual actualizado en el servicio:', this.currentPlayer);
  }

  /**
   * Obtiene el resultado del dado.
   */
  getDiceResult(): number | null {
    return this.diceResult;
  }

  /**
   * Lanza los dados y mueve al jugador.
   */
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


  /**
   * Notifica a los suscriptores que el estado del juego ha cambiado.
   */
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

  /**
   * Maneja el fin del juego.
   */
  private handleGameOver(message: any): void {
    console.log('Juego terminado. Resultados:', message);
    // Aquí puedes mostrar un modal con los resultados
    alert(`El juego ha terminado. El ganador es: ${message.winnerName}`);
    
    // Redirigir al usuario a la vista '/matchmaking'
    this.router.navigate(['/matchmaking']);
}
  // ===================================================================================================

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
        } else if (normalizedMessage.type === 'gameUpdate') {
            this.handleGameUpdate(normalizedMessage);
        } else if (normalizedMessage.type === 'playerJoined') {
            this.handlePlayerJoined(normalizedMessage);
        } else if (normalizedMessage.type === 'botMove') {
            this.handleBotMove(normalizedMessage);
        } else if (normalizedMessage.type === 'gameOver') {
            this.handleGameOver(normalizedMessage); // Manejar el fin del juego
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
 * Maneja la actualización del estado del juego.
 */
  private handleGameUpdate(message: any): void {
    console.log('WebSocketService: Actualización del estado del juego recibida:', message);
  
    // Verificar si los jugadores están presentes en el mensaje
    if (message.players) {
      console.log('Jugadores recibidos:', message.players);
  
      // Convertir players en un arreglo si es un objeto
      const playersArray = Array.isArray(message.players) 
        ? message.players 
        : Object.values(message.players);
  
      // Añadir propiedades isMoving y targetPosition a cada jugador
      this.players = playersArray.map((player: any) => ({
        ...player,
        isMoving: false, // Añadir propiedad isMoving
        targetPosition: player.position, // Añadir propiedad targetPosition
      }));
  
      console.log('Jugadores actualizados:', this.players);
    } else {
      console.warn('No se recibieron jugadores en la actualización del juego.');
    }
  
    // Verificar si el jugador actual está presente en el mensaje
    if (message.currentPlayer) {
      console.log('Jugador actual recibido:', message.currentPlayer);
      this.currentPlayer = message.currentPlayer;
      console.log('Jugador actual actualizado:', this.currentPlayer);
    } else {
      console.warn('No se recibió el jugador actual en la actualización del juego.');
    }
  
    // Verificar si el resultado del dado está presente en el mensaje
    if (message.diceResult !== undefined) {
      console.log('Resultado del dado recibido:', message.diceResult);
      this.diceResult = message.diceResult;
      console.log('Resultado del dado actualizado:', this.diceResult);
    } else {
      console.warn('No se recibió el resultado del dado en la actualización del juego.');
    }
  
    // Notificar a los suscriptores que el estado del juego ha cambiado
    this.notifyGameStateUpdate();
  }

  /**
   * Maneja la entrada de un nuevo jugador.
   */
  private handlePlayerJoined(message: any): void {
      console.log('WebSocketService: Jugador unido:', message);
      this.players = message.players;
      this.notifyGameStateUpdate();
  }

  /**
   * Maneja el movimiento del bot.
   */
  private handleBotMove(message: any): void {
      console.log('WebSocketService: Movimiento del bot:', message);
      const bot = this.players.find(player => player.id === message.playerId);
      if (bot) {
          bot.position = message.newPosition;
      }
      this.notifyGameStateUpdate();
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
  private handleGameStarted(message: any): void {
    console.log('WebSocketService: Partida iniciada:', message);
  
    // Actualizar la lista de jugadores
    if (message.players) {
      this.players = message.players;
      this.currentPlayer = this.players[0]; // Asignar el primer jugador como currentPlayer
      this.notifyGameStateUpdate(); // Notificar a los suscriptores
    }
  
    // Notificar al componente que la partida ha comenzado
    this.messageReceived.next({
      type: 'gameStarted',
      gameId: message.gameId,
      players: message.players
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
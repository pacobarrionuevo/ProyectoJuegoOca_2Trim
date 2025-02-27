import { Injectable } from '@angular/core';
import { WebsocketService } from './websocket.service';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Subject } from 'rxjs';
import { environment } from '../../environments/environment';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class GameService {
  private players: any[] = []; // Lista de jugadores
  private currentPlayer: any = null; // Jugador actual
  private gameId: string | null = null; // ID de la partida
  private diceResult: number | null = null; // Resultado del dado

  // Subject para notificar cambios en el estado del juego
  gameStateUpdated = new Subject<{ players: any[], currentPlayer: any, diceResult: number | null }>();

  constructor(private http: HttpClient, private websocketService: WebsocketService) {
    // Suscribirse a los mensajes del WebSocket
    this.websocketService.messageReceived.subscribe((message: any) => {
      console.log('Mensaje recibido en GameService:', message);
      this.handleMessage(message);
    });
  }

  startGame(gameId: string, playerName: string): Observable<any> {
    const body = { GameId: gameId, PlayerName: playerName }; // Asegúrate de que los nombres de los campos coincidan con lo que espera el servidor
    return this.http.post<any>(`${environment.apiUrl}/api/Game/start-game`, body).pipe(
      catchError((error) => {
        console.error('Error al iniciar la partida:', error);
        return of(null); // Devuelve null en caso de error
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
    console.log('Obteniendo usuario real:', this.currentUser);
    return this.currentUser;
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
    if (!this.currentPlayer) {
      console.error('No hay un jugador actual definido.');
      return;
    }
  
    this.diceResult = Math.floor(Math.random() * 6) + 1; // Lanzar un dado de 6 caras
    console.log('Resultado del dado:', this.diceResult);
  
    // Enviar el movimiento al servidor
    const moveMessage = {
      type: 'movePlayer',
      gameId: this.gameId,
      playerId: this.currentPlayer.id,
      diceResult: this.diceResult
    };
    this.websocketService.sendRxjs(JSON.stringify(moveMessage));
  
    // Notificar a los suscriptores que el estado del juego ha cambiado
    this.notifyGameStateUpdate();
  }

  /**
   * Maneja los mensajes recibidos del servidor.
   */
  private handleMessage(message: any): void {
    console.log('Mensaje recibido en GameService:', message);
  
    if (message.type === 'gameUpdate') {
        this.players = message.players;
        this.currentPlayer = message.currentPlayer;
        this.notifyGameStateUpdate();
    } else if (message.type === 'playerJoined') {
        this.players = message.players;
        this.notifyGameStateUpdate();
    } else if (message.type === 'botMove') {
        // Actualizar la posición del bot en el cliente
        const bot = this.players.find(player => player.id === message.playerId);
        if (bot) {
            bot.position = message.newPosition;
        }
        this.notifyGameStateUpdate();
    } else if (message.type === 'gameOver') {
        this.handleGameOver(message.results);
    }
  }

  /**
   * Notifica a los suscriptores que el estado del juego ha cambiado.
   */
  private notifyGameStateUpdate(): void {
    console.log('Notificando actualización del estado del juego...');
    this.gameStateUpdated.next({
      players: this.players,
      currentPlayer: this.currentPlayer,
      diceResult: this.diceResult
    });
  }

  /**
   * Maneja el fin del juego.
   */
  private handleGameOver(results: any): void {
    console.log('Juego terminado. Resultados:', results);
    // Aquí puedes mostrar un modal con los resultados
    alert(`El juego ha terminado. El ganador es: ${results.winnerId}`);
  }

  
}
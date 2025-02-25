import { Injectable } from '@angular/core';
import { WebsocketService } from './websocket.service';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class GameService {
  private players: any[] = []; // Lista de jugadores
  private currentPlayer: any; // Jugador actual
  private gameId: string | null = null; // ID de la partida
  private diceResult: number | null = null; // Resultado del dado

  // Subject para notificar cambios en el estado del juego
  gameStateUpdated = new Subject<{ players: any[], currentPlayer: any, diceResult: number | null }>();

  constructor(private websocketService: WebsocketService) {
    // Suscribirse a los mensajes del WebSocket
    this.websocketService.messageReceived.subscribe((message: any) => {
      this.handleMessage(message);
    });
  }

  /**
   * Inicia una nueva partida.
   */
  startGame(gameId: string): void {
    this.gameId = gameId;
    console.log('Partida iniciada con ID:', this.gameId);
  }

  /**
   * Obtiene la lista de jugadores.
   */
  getPlayers(): any[] {
    return this.players;
  }

  /**
   * Obtiene el jugador actual.
   */
  getCurrentPlayer(): any {
    return this.currentPlayer;
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
  }

  /**
   * Maneja los mensajes recibidos del servidor.
   */
  private handleMessage(message: any): void {
    console.log('Mensaje recibido en GameService:', message);

    if (message.type === 'gameUpdate') {
      // Actualizar el estado del juego
      this.players = message.players;
      this.currentPlayer = message.currentPlayer;
      this.notifyGameStateUpdate();
    } else if (message.type === 'gameOver') {
      // Manejar el fin del juego
      this.handleGameOver(message.results);
    }
  }

  /**
   * Notifica a los suscriptores que el estado del juego ha cambiado.
   */
  private notifyGameStateUpdate(): void {
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
  }
}
import { Injectable } from '@angular/core';
import { WebsocketService } from './websocket.service';
import { Subject } from 'rxjs';

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
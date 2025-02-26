import { Component, OnInit } from '@angular/core';
import { GameService } from '../../services/game.service';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-game',
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.css'],
  standalone: true,
  imports: [RouterModule, CommonModule],
})
export class GameComponent implements OnInit {
  players: any[] = [];
  currentPlayer: any;
  diceResult: number | null = null;
  cells: any[] = []; // Casillas del tablero

  constructor(private gameService: GameService) {}

  ngOnInit(): void {
    // Inicializar el tablero
    this.initializeBoard();

    // Suscribirse a las actualizaciones del estado del juego
    this.gameService.gameStateUpdated.subscribe((state: any) => {
      this.players = state.players;
      this.currentPlayer = state.currentPlayer;
      this.diceResult = state.diceResult;
    });

    // Iniciar la partida (ejemplo)
    this.gameService.startGame('12345'); // Reemplaza '12345' con el ID real de la partida
  }

  /**
   * Inicializa el tablero con 63 casillas.
   */
  initializeBoard(): void {
    for (let i = 1; i <= 63; i++) {
      this.cells.push({ number: i, type: this.getCellType(i) });
    }
  }

  /**
   * Obtiene el tipo de casilla (Oca, Puente, Posada, Muerte, etc.).
   */
  getCellType(cellNumber: number): string {
    if (cellNumber % 9 === 0 && cellNumber !== 63) return 'Oca';
    if (cellNumber === 6 || cellNumber === 12) return 'Puente';
    if (cellNumber === 19 || cellNumber === 31 || cellNumber === 42) return 'Posada';
    if (cellNumber === 58) return 'Muerte';
    return 'Normal';
  }

  /**
   * Obtiene los jugadores que están en una casilla.
   */
  getPlayersInCell(cellNumber: number): any[] {
    return this.players.filter(player => player.position === cellNumber);
  }

  /**
   * Calcula la posición (x, y) de una celda en el tablero.
   */
  getCellPosition(cellNumber: number): { x: number, y: number } {
    // Lógica para calcular la posición de la celda en el tablero
    // Esto es un ejemplo básico, ajusta según la disposición en espiral del juego de la Oca
    const row = Math.floor((cellNumber - 1) / 9);
    const col = (cellNumber - 1) % 9;
    return { x: col * 60, y: row * 60 }; // Ajusta el espaciado según sea necesario
  }

  /**
   * Verifica si el jugador actual es el usuario.
   */
  get isCurrentPlayer(): boolean {
    return this.currentPlayer && this.currentPlayer.id === 1; // Reemplaza con la lógica real
  }

  /**
   * Lanza los dados.
   */
  rollDice(): void {
    this.gameService.rollDice();
  }
}
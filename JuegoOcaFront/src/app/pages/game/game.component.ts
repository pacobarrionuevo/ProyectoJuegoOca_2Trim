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
   * Calcula la posición (x, y) de una celda en el tablero en espiral invertida.
   */
  getCellPosition(cellNumber: number): { x: number, y: number } {
    // Tamaño de cada celda (ancho y alto)
    const cellSize = 60; // Ajusta el tamaño de las celdas según sea necesario

    // Número de casillas por lado del tablero
    const boardSize = 9; // Tablero de 9x9 (centrado en la casilla 63)

    // Coordenadas del centro del tablero
    const centerX = (boardSize * cellSize) / 2;
    const centerY = (boardSize * cellSize) / 2;

    // Calcular la posición en espiral invertida
    const spiralPosition = this.calculateInverseSpiralPosition(cellNumber, boardSize);

    // Calcular las coordenadas (x, y) basadas en la posición en espiral
    const x = centerX + spiralPosition.x * cellSize;
    const y = centerY + spiralPosition.y * cellSize;

    return { x, y };
  }

  /**
   * Calcula la posición en espiral invertida para una celda dada.
   */
  calculateInverseSpiralPosition(cellNumber: number, boardSize: number): { x: number, y: number } {
    // Invertir el número de la celda para comenzar desde el centro
    const invertedCellNumber = 64 - cellNumber; // 63 -> 1, 62 -> 2, ..., 1 -> 63

    // Lógica para calcular la posición en espiral
    let x = 0;
    let y = 0;
    let direction = 0; // 0: derecha, 1: abajo, 2: izquierda, 3: arriba
    let steps = 1; // Número de pasos en la dirección actual
    let stepCount = 0; // Contador de pasos en la dirección actual
    let stepSize = 1; // Tamaño del paso actual

    for (let i = 1; i < invertedCellNumber; i++) {
      // Mover en la dirección actual
      if (direction === 0) x++;
      else if (direction === 1) y++;
      else if (direction === 2) x--;
      else if (direction === 3) y--;

      stepCount++;

      // Cambiar de dirección si se alcanza el número de pasos
      if (stepCount === stepSize) {
        stepCount = 0;
        direction = (direction + 1) % 4; // Cambiar de dirección

        // Aumentar el tamaño del paso cada dos direcciones
        if (direction === 0 || direction === 2) stepSize++;
      }
    }

    return { x, y };
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

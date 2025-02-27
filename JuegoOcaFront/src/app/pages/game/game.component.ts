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
    console.log('Inicializando GameComponent...');

    // Inicializar el tablero
    this.initializeBoard();

    // Iniciar la partida y obtener los jugadores
    const playerName = "Jugador1"; // Nombre del jugador humano
    this.gameService.startGame('12345', playerName).subscribe((response) => {
        if (response && response.players) {
            console.log('Partida iniciada correctamente:', response);
            this.players = response.players;

            // Establecer el usuario real
            const currentUser = this.players.find(player => player.name !== "Bot");
            if (currentUser) {
                console.log('Usuario real detectado:', currentUser);
                this.gameService.setCurrentUser(currentUser);
            } else {
                console.warn('No se encontró un usuario real en la lista de jugadores.');
            }

            // Asignar el primer jugador como currentPlayer
            this.currentPlayer = this.players[0];
            this.gameService.setCurrentPlayer(this.currentPlayer);
            console.log('Jugador actual asignado:', this.currentPlayer);
        } else {
            console.error('No se pudo iniciar la partida o la lista de jugadores está vacía.');
        }
    });

    // Suscribirse a las actualizaciones del estado del juego
    this.gameService.gameStateUpdated.subscribe((state: any) => {
        console.log('Actualización del estado del juego recibida:', state);
        this.players = state.players;
        this.currentPlayer = state.currentPlayer;
        this.diceResult = state.diceResult;

        console.log('Jugadores actualizados:', this.players);
        console.log('Jugador actual actualizado:', this.currentPlayer);
        console.log('Resultado del dado actualizado:', this.diceResult);

        // Si es el turno del bot, realizar una tirada automática
        if (this.currentPlayer && this.currentPlayer.name === "Bot") {
            console.log('Es el turno del bot. Realizando tirada automática...');
            setTimeout(() => {
                this.gameService.rollDice();
            }, 1000); // Esperar 1 segundo antes de que el bot tire el dado
        }
    });
}
  
  getPlayersInCell(cellNumber: number): any[] {
    if (!this.players) {
      console.warn('La lista de jugadores no está inicializada.');
      return [];
    }
    return this.players.filter(player => player.position === cellNumber);
  }

  /**
   * Verifica si el jugador actual es el usuario real.
   */
  get isCurrentPlayer(): boolean {
    const currentUser = this.gameService.getCurrentUser(); // Obtener el usuario real desde el servicio
    const isCurrent = this.currentPlayer && this.currentPlayer.id === currentUser?.id;

    console.log('Verificando si el jugador actual es el usuario real:');
    console.log('Jugador actual:', this.currentPlayer);
    console.log('Usuario real:', currentUser);
    console.log('¿Es el usuario real?', isCurrent);

    return isCurrent;
  }

  /**
   * Inicializa el tablero con 63 casillas.
   */
  initializeBoard(): void {
    console.log('Inicializando tablero...');
    for (let i = 1; i <= 63; i++) {
      this.cells.push({ number: i, type: this.getCellType(i) });
    }
    console.log('Tablero inicializado:', this.cells);
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
   * Lanza los dados.
   */
  rollDice(): void {
    console.log('Lanzando dado...');
    this.gameService.rollDice();
  }
}
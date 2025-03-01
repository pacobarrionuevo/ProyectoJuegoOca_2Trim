import { Component, OnInit } from '@angular/core';
import { WebsocketService } from '../../services/websocket.service'; // Importa el WebsocketService
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ImageService } from '../../services/image.service';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-game',
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.css'],
  standalone: true,
  imports: [RouterModule, CommonModule],
})
export class GameComponent implements OnInit {
  // inicializamos fotos
  versus: string;
  fotoOca: string;
  fotoPosada: string;
  fotoPuente: string;
  fotoMuerte: string;
  fotoDados: string;
  fotoCarcel: string;
  fotoLaberinto: string;
  fotoPozo: string;
  fotoAbajo: string;
  fotoDerecha: string;
  fotoIzquierda: string;
  fotoArriba: string;
  fotoBanderaInicio: string;

  players: any[] = [];
  currentPlayer: any;
  diceResult: number | null = null;
  cells: any[] = []; // Casillas del tablero

  usuarioApodo: string = '';
  usuarioFotoPerfil: string = '';
  usuarioId: number | null = null;

  winnerName: string = '';
  gameOver: boolean = false;

  moveMessage: string = '';
  showMoveMessage: boolean = false;

  // Inyecta el WebsocketService
  constructor(private websocketService: WebsocketService, private imageService: ImageService, private authService: AuthService,
      private router: Router) {
    this.versus = this.imageService.getImageUrl('Street_Fighter_VS_logo.png');
    this.fotoOca = this.imageService.getImageUrl('OcaFoto.jpg');
    this.fotoPosada = this.imageService.getImageUrl('RockingBeatas.jpg');
    this.fotoPuente = this.imageService.getImageUrl('puente.jpeg');
    this.fotoMuerte = this.imageService.getImageUrl('verdaderamuerte.png');
    this.fotoDados = this.imageService.getImageUrl('balatrodice.png');
    this.fotoCarcel = this.imageService.getImageUrl('carcel.png');
    this.fotoLaberinto = this.imageService.getImageUrl('laberinto.jpg');
    this.fotoPozo = this.imageService.getImageUrl('pozo.jpg');
    this.fotoAbajo = this.imageService.getImageUrl('FlechaAbajo.png');
    this.fotoDerecha = this.imageService.getImageUrl('FlechaDerecha.png');
    this.fotoIzquierda = this.imageService.getImageUrl('FlechaIzquierda.png');
    this.fotoArriba = this.imageService.getImageUrl('FlechaArriba.png');
    this.fotoBanderaInicio = this.imageService.getImageUrl('banderainicio.jpg');
  } 

  ngOnInit(): void {
    console.log('Inicializando GameComponent...');

    // Inicializar el tablero
    this.initializeBoard();

    this.cargarInfoUsuario();

    // Iniciar la partida y obtener los jugadores
    const playerName = this.usuarioApodo; // Nombre del jugador humano
    this.websocketService.startGame('12345', playerName).subscribe((response) => {
        if (response && response.players) {
            console.log('Partida iniciada correctamente:', response);
            this.players = response.players;
            // Establecer el usuario real
            const currentUser = this.players.find(player => player.name !== "Bot");
            if (currentUser) {
                console.log('Usuario real detectado:', currentUser);
                this.websocketService.setCurrentUser(currentUser);
            } else {
                console.warn('No se encontró un usuario real en la lista de jugadores.');
            }

            // Asignar el primer jugador como currentPlayer
            this.currentPlayer = this.players[0];
            this.websocketService.setCurrentPlayer(this.currentPlayer);
            console.log('Jugador actual asignado:', this.currentPlayer);
        } else {
            console.error('No se pudo iniciar la partida o la lista de jugadores está vacía.');
        }
    });

    // Suscribirse a las actualizaciones del estado del juego
    this.websocketService.gameStateUpdated.subscribe((state: any) => {
      console.log('Actualización del estado del juego recibida en GameComponent:', state);
  
      // Convertir players en un arreglo si es un objeto
      const playersArray = Array.isArray(state.players) ? state.players : Object.values(state.players);
  
      // Actualizar las propiedades del componente
      this.players = [...playersArray]; // Crear una nueva instancia del arreglo
      this.currentPlayer = { ...state.currentPlayer }; // Crear una nueva instancia del objeto
      this.diceResult = state.diceResult;
  
      console.log('Jugadores actualizados en GameComponent:', this.players);
      console.log('Jugador actual actualizado en GameComponent:', this.currentPlayer);
      console.log('Resultado del dado actualizado en GameComponent:', this.diceResult);
  
      // Si es el turno del bot, realizar una tirada automática
      if (this.currentPlayer && this.currentPlayer.name === "Bot") {
          console.log('Es el turno del bot. Realizando tirada automática...');
          setTimeout(() => {
              this.websocketService.rollDice();
          }, 5000); // Esperar 5 segundo antes de que el bot tire el dado
      }
    });

    this.websocketService.messageReceived.subscribe((message: any) => {
      if (message.type === 'skipTurn') {
          this.showSkipTurnMessage(message);
      }
    });

    // Subscribirse a que se envíen mensajes de los resultados del turno
    this.websocketService.messageReceived.subscribe((message: any) => {
      if (message.type === 'moveResult') {
          this.showMoveResult(message);
      }
    });

    // Suscribirse al mensaje de fin de juego
    this.websocketService.messageReceived.subscribe((message: any) => {
        if (message.type === 'gameOver') {
          this.gameOver = true;
          this.showGameOverModal(message.winnerName);
        }
    });
}

showGameOverModal(winnerName: string): void {
    // Aquí puedes mostrar un modal con el resultado del juego
    alert(`El juego ha terminado. El ganador es: ${winnerName}`);
    
    // Redirigir al usuario a la vista '/matchmaking'
    this.router.navigate(['/matchmaking']);
}

showSkipTurnMessage(message: any): void {
  this.moveMessage = `${message.playerName} pierde ${message.turnsToSkip} turno(s).`;
  this.showMoveMessage = true;

  // Ocultar el mensaje después de unos segundos
  setTimeout(() => {
      this.showMoveMessage = false;
  }, 5000); // 5 segundos
}

showMoveResult(message: any): void {
  this.moveMessage = `${message.playerName} ha sacado un ${message.diceResult}. `;
  this.moveMessage += `Se mueve a la casilla ${message.newPosition}. `;
  if (message.specialMessage) {
      this.moveMessage += message.specialMessage;
  }
  this.showMoveMessage = true;

  // Ocultar el mensaje después de unos segundos
  setTimeout(() => {
      this.showMoveMessage = false;
  }, 5000); // 5 segundos
}

validarUrlImagen(fotoPerfil: string | null): string {
    return fotoPerfil ? `${environment.apiUrl}/fotos/${fotoPerfil}` : 'na';
  }

  cargarInfoUsuario(): void {
    const userInfo = this.authService.getUserDataFromToken();
    if (userInfo) {
      this.usuarioApodo = userInfo.name;
      this.usuarioFotoPerfil = this.validarUrlImagen(userInfo.profilePicture);
      this.usuarioId = userInfo.id;
    } else {
      console.error('No se pudo obtener la información del usuario. ¿El token está disponible?');
      this.router.navigate(['/login']); // Redirigir al login si no hay token
    }
  }

  getPlayersInCell(cellNumber: number): any[] {
    if (!this.players) {
      console.warn('La lista de jugadores no está inicializada.');
      console.log('Salguero hijoputa');
      return [];
    }
    return this.players.filter(player => player.position === cellNumber);
  }

  /**
   * Verifica si el jugador actual es el usuario real.
   */
  get isCurrentPlayer(): boolean {
    const currentUser = this.websocketService.getCurrentUser(); // Obtener el usuario real desde el servicio
    const isCurrent = this.currentPlayer && this.currentPlayer.id === currentUser?.id;
    return isCurrent;
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
    if (cellNumber === 1) return 'Inicio';
    if (cellNumber === 2 || cellNumber === 3 || cellNumber === 4 || cellNumber === 28 || cellNumber === 29 
      || cellNumber === 30 || cellNumber === 47 || cellNumber === 48 || cellNumber === 49 || cellNumber === 60
    ) return 'FlechaDerecha';
    if (cellNumber === 7 || cellNumber === 8 || cellNumber === 10 || cellNumber === 11 || cellNumber === 13 
      || cellNumber === 33 || cellNumber === 34 || cellNumber === 35 || cellNumber === 37 || cellNumber === 51 || cellNumber === 61
    ) return 'FlechaArriba';
    if (cellNumber === 15 || cellNumber === 16 || cellNumber === 17 || cellNumber === 20 || cellNumber === 38 || cellNumber === 39 
      || cellNumber === 40 || cellNumber === 55 || cellNumber === 56 || cellNumber === 62) return 'FlechaIzquierda';
    if (cellNumber === 21 || cellNumber === 22 || cellNumber === 24 || cellNumber === 25 || cellNumber === 43 || cellNumber === 44 || cellNumber === 46 
      || cellNumber === 57) return 'FlechaAbajo';
    if (cellNumber === 5 || cellNumber === 9 || cellNumber === 14 || cellNumber === 18
      || cellNumber === 23 || cellNumber === 27 || cellNumber === 32 || cellNumber === 36
      || cellNumber === 41 || cellNumber === 45 || cellNumber === 50 || cellNumber === 54
      || cellNumber === 59 || cellNumber === 63) return 'Oca';
    if (cellNumber === 6 || cellNumber === 12) return 'Puente';
    if (cellNumber === 19) return 'Posada';
    if (cellNumber === 26 || cellNumber === 53) return 'Dados';
    if (cellNumber === 31) return 'Pozo';
    if (cellNumber === 42) return 'Laberinto';
    if (cellNumber === 52) return 'Carcel';
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
    this.websocketService.rollDice(); // Llama al método rollDice del WebsocketService
  }
}
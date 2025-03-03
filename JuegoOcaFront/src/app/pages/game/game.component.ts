import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { WebsocketService } from '../../services/websocket.service'; // Importa el WebsocketService
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ImageService } from '../../services/image.service';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-game',
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.css'],
  standalone: true,
  imports: [RouterModule, CommonModule, FormsModule],
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
  cells: any[] = [];

  usuarioApodo: string = '';
  usuarioFotoPerfil: string = '';
  usuarioId: number | null = null;

  winnerName: string = '';
  gameOver: boolean = false;

  moveMessage: string = '';
  showMoveMessage: boolean = false;

  messages: { sender: string, text: string }[] = [];
  newMessage: string = '';
  @ViewChild('chatMessages') private chatMessagesContainer!: ElementRef;

  isSending: boolean = false;

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
    this.initializeBoard();

    this.cargarInfoUsuario();

    const playerName = this.usuarioApodo;
    this.websocketService.startGame('12345', playerName,'Bot').subscribe((response) => {
        if (response && response.players) {
            this.players = response.players;
            const currentUser = this.players.find(player => player.name !== "Bot");
            if (currentUser) {
                this.websocketService.setCurrentUser(currentUser);
            } else {
            }
            this.currentPlayer = this.players[0];
            this.websocketService.setCurrentPlayer(this.currentPlayer);
        } else {
        }
    });

    this.websocketService.gameStateUpdated.subscribe((state: any) => {
      const playersArray = Array.isArray(state.players) ? state.players : Object.values(state.players);
  
      this.players = [...playersArray];
      this.currentPlayer = { ...state.currentPlayer };
      this.diceResult = state.diceResult;
      if (this.currentPlayer && this.currentPlayer.name === "Bot") {
          setTimeout(() => {
              this.websocketService.rollDice();
          }, 3000);
      }
    });

    this.websocketService.messageReceived.subscribe((message: any) => {
      if (message.type === 'skipTurn') {
          this.showSkipTurnMessage(message);
      }
    });

    this.websocketService.messageReceived.subscribe((message: any) => {
      if (message.type === 'moveResult') {
          this.showMoveResult(message);
      }
    });

    this.websocketService.messageReceived.subscribe((message: any) => {
        if (message.type === 'gameOver') {
          this.gameOver = true;
          this.showGameOverModal(message.winnerName);
        }
    });

    this.websocketService.messageReceived.subscribe((message: any) => {
      if (message.type === 'chatMessage') {
          this.messages.push({ sender: message.sender, text: message.text });
          this.scrollChatToBottom();
      }
  });
}

sendMessage(): void {
  if (this.isSending || !this.newMessage.trim()) return;

  this.isSending = true; 

  const sender = this.usuarioApodo; 
  this.websocketService.sendRxjs(JSON.stringify({
    type: 'chatMessage',
    sender: sender,
    text: this.newMessage
  }));

  this.newMessage = ''; 
  this.isSending = false;
}

scrollChatToBottom(): void {
  try {
    this.chatMessagesContainer.nativeElement.scrollTop = this.chatMessagesContainer.nativeElement.scrollHeight;
  } catch(err) { }
}

showGameOverModal(winnerName: string): void {
    alert(`El juego ha terminado. El ganador es: ${winnerName}`);
    this.router.navigate(['/matchmaking']);
}

showSkipTurnMessage(message: any): void {
  this.moveMessage = `${message.playerName} pierde ${message.turnsToSkip} turno(s).`;
  this.showMoveMessage = true;
  setTimeout(() => {
      this.showMoveMessage = false;
  }, 2000);
}

showMoveResult(message: any): void {
  this.moveMessage = `${message.playerName} ha sacado un ${message.diceResult}. `;
  this.moveMessage += `Se mueve a la casilla ${message.newPosition}. `;
  if (message.specialMessage) {
      this.moveMessage += message.specialMessage;
  }
  this.showMoveMessage = true;
  setTimeout(() => {
      this.showMoveMessage = false;
  }, 2000);
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
      this.router.navigate(['/login']); 
    }
  }

  getPlayersInCell(cellNumber: number): any[] {
    if (!this.players) {
      return [];
    }
    return this.players.filter(player => player.position === cellNumber);
  }

  get isCurrentPlayer(): boolean {
    const currentUser = this.websocketService.getCurrentUser();
    const isCurrent = this.currentPlayer && this.currentPlayer.id === currentUser?.id;
    return isCurrent;
  }

  initializeBoard(): void {
    for (let i = 1; i <= 63; i++) {
      this.cells.push({ number: i, type: this.getCellType(i) });
    }
  }

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

  // Este es el método que calcula la posición (x, y) de una celda en el tablero del juego
  getCellPosition(cellNumber: number): { x: number, y: number } {
    // Tamaño de cada celda (ancho y alto)
    const cellSize = 60;

    const boardSize = 9; // Tablero de 9x9 centrado en la casilla 63 (no es el de la oca original pero close enough)

    // Coordenadas del centro del tablero
    const centerX = (boardSize * cellSize) / 2;
    const centerY = (boardSize * cellSize) / 2;

    // Llamamos al método que calcula la posición en espiral invertida
    const spiralPosition = this.calculateInverseSpiralPosition(cellNumber, boardSize);

    // Calcular las coordenadas (x, y) basadas en la posición en espiral
    const x = centerX + spiralPosition.x * cellSize;
    const y = centerY + spiralPosition.y * cellSize;

    return { x, y };
  }

  // Calcula la posición en espiral invertida para una celda dada, para cuando se tenga que mover una ficha a una casilla que no sea horizontal
  calculateInverseSpiralPosition(cellNumber: number, boardSize: number): { x: number, y: number } {
    // Invertir el número de la celda para comenzar desde el centro
    const invertedCellNumber = 64 - cellNumber;

    // Variables

    let x = 0;
    let y = 0;

    // 0: derecha, 1: abajo, 2: izquierda, 3: arriba

    let direction = 0;
    let steps = 1;
    let stepCount = 0;
    let stepSize = 1;

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

  rollDice(): void {
    this.websocketService.rollDice();
  }
}
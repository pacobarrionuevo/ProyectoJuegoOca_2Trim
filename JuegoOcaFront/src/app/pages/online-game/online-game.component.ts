import { Component, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, timer } from 'rxjs';
import { WebsocketService } from '../../services/websocket.service';
import { ImageService } from '../../services/image.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-game-online',
  templateUrl: './online-game.component.html',
  styleUrls: ['./online-game.component.css'],
  standalone: true,
  imports: [RouterModule, CommonModule, FormsModule]
})
export class GameOnlineComponent implements OnInit, OnDestroy {
  // Imágenes para el tablero y elementos gráficos
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

  // Estado del juego
  players: any[] = [];
  currentPlayer: any;
  diceResult: number | null = null;
  cells: any[] = []; // Casillas del tablero

  // Datos del usuario
  usuarioApodo: string = '';
  usuarioFotoPerfil: string = '';
  usuarioId: number | null = null;
  opponentName: string = '';

  // Variables para el fin de partida
  winnerName: string = '';
  gameOver: boolean = false;
  moveMessage: string = '';
  showMoveMessage: boolean = false;

  // Chat en tiempo real
  messages: { sender: string, text: string }[] = [];
  newMessage: string = '';

  // Temporizador de turno
  turnTimerSubscription: Subscription | null = null;
  turnTimeLimit: number = 120; // 2 minutos (120 segundos)
  timeRemaining: number = this.turnTimeLimit;
  showRematchModal: boolean = false;
  turnTimerSub!: Subscription;
  @ViewChild('chatMessages') private chatMessagesContainer!: ElementRef;

  constructor(
    private websocketService: WebsocketService,
    private imageService: ImageService,
    private authService: AuthService,
    private router: Router
  ) {
    // Inicializar rutas de imágenes (modifica los nombres según tus assets)
    this.versus = this.imageService.getImageUrl('VersusOnline.png');
    this.fotoOca = this.imageService.getImageUrl('OcaFoto.jpg');
    this.fotoPosada = this.imageService.getImageUrl('Posada.jpg');
    this.fotoPuente = this.imageService.getImageUrl('Puente.jpeg');
    this.fotoMuerte = this.imageService.getImageUrl('Muerte.png');
    this.fotoDados = this.imageService.getImageUrl('Dados.png');
    this.fotoCarcel = this.imageService.getImageUrl('Carcel.png');
    this.fotoLaberinto = this.imageService.getImageUrl('Laberinto.jpg');
    this.fotoPozo = this.imageService.getImageUrl('Pozo.jpg');
    this.fotoAbajo = this.imageService.getImageUrl('FlechaAbajo.png');
    this.fotoDerecha = this.imageService.getImageUrl('FlechaDerecha.png');
    this.fotoIzquierda = this.imageService.getImageUrl('FlechaIzquierda.png');
    this.fotoArriba = this.imageService.getImageUrl('FlechaArriba.png');
    this.fotoBanderaInicio = this.imageService.getImageUrl('BanderaInicio.jpg');
  }

  ngOnInit(): void {
    console.log('Iniciando GameOnlineComponent...');
    this.initializeBoard();
    this.cargarInfoUsuario();

    // Iniciar partida online (se debe obtener el gameId desde el matchmaking o de la navegación)
    const playerName = this.usuarioApodo;
    const gameId = 'game-online-id'; // Este valor se asigna dinámicamente según el flujo de matchmaking
    this.websocketService.startGame(gameId, playerName, 'Multiplayer').subscribe(response => {
      
      if (response && response.players) {
        this.players = response.players;
        // Asumimos que el usuario autenticado se encuentra en la lista de jugadores
        const currentUser = this.players.find(player => player.id === this.usuarioId);
        if (currentUser) {
          this.websocketService.setCurrentUser(currentUser);
        }
        // Asignamos el primer jugador como turno inicial (ajusta según la lógica de turno)
        this.currentPlayer = this.players[0];
        this.websocketService.setCurrentPlayer(this.currentPlayer);
      } else {
        console.error('Error al iniciar la partida online.');
      }
    });

    
    this.websocketService.gameStateUpdated.subscribe((state: any) => {
      console.log('\n--- RECIBIENDO ESTADO DEL JUEGO ---');
      console.log('Estado crudo recibido:', state);
      
      // Conversión de jugadores
      const playersArray = Array.isArray(state.players) 
        ? state.players 
        : Object.values(state.players);
      
      console.log('Jugadores convertidos:', playersArray);
      
      this.players = playersArray.map(p => ({
        id: p.id ?? p.Id,
        name: p.name ?? p.Name,
        position: p.position ?? p.Position,
        turnsToSkip: p.turnsToSkip ?? p.TurnsToSkip,
        isMoving: false,
       
      }));
      
      console.log('Jugadores mapeados:', this.players);
    
      // Interpretar jugador actual
      const currentPlayerId = state.currentPlayer?.id ?? state.currentPlayer?.Id;
      console.log('ID de jugador actual recibido:', currentPlayerId);
      
      this.currentPlayer = this.players.find(p => p.id === currentPlayerId);
      console.log('Jugador actual detectado:', this.currentPlayer);
    
      this.diceResult = state.diceResult;
      this.startTurnTimer();
    });

    // Suscribirse a mensajes del WebSocket (chat, gameOver, rematch, etc.)
    this.websocketService.messageReceived.subscribe((message: any) => {
      if (message.type === 'chatMessage') {
        this.messages.push({ sender: message.sender, text: message.text });
        this.scrollChatToBottom();
      } else if (message.type === 'gameOver') {
        this.gameOver = true;
        this.winnerName = message.winnerName;
        this.showGameOverModal(message.winnerName, message.scores);
      } else if (message.type === 'rematchResponse') {
        if (message.accepted) {
          this.restartGame();
        } else {
          alert('La revancha no fue aceptada por ambos. Volviendo al menú.');
          this.router.navigate(['/menu']);
        }
      } else if (message.type === 'turnTimeout') {
        this.handleTurnTimeout(message.playerId)
      }else if (message.type === 'abandonGame') {
        this.handleOpponentAbandoned();
      }else if (message.type === 'rematchRequest') {
        this.showRematchModal = true;
      }else if (message.type === 'rematchResponse') {
        this.handleRematchResponse(message);
      }
      // Se pueden agregar más tipos de mensajes según necesidades
    });

    // Iniciar el temporizador del turno
    this.startTurnTimer();
  }
  private handleGameOver(winner: any): void {
    this.gameOver = true;
    this.winnerName = winner.name;
    this.showGameOverModal(winner.name, {});
  }
  
  private handleRematchResponse(message: any): void {
    if (message.accepted) {
      this.restartGame();
    } else {
      this.showRematchModal = false;
      alert('El oponente rechazó la revancha');
    }
  }
  getPlayersInCell(cellNumber: number): any[] {
    return this.players.filter(player => 
      player.position === cellNumber && 
      !player.isMoving
    );
  }
  private handleGameStateUpdate(state: any): void {
    this.players = state.players;
    this.currentPlayer = state.currentPlayer;
    this.diceResult = state.diceResult;
    
    if (state.gameOver) {
      this.handleGameOver(state.winner);
    }
  }
  private startTurnTimer(): void {
    console.log('\n--- INICIANDO TEMPORIZADOR ---');
    if (this.turnTimerSub) {
      console.log('Cancelando temporizador anterior');
      this.turnTimerSub.unsubscribe();
    }
    
    this.timeRemaining = 120;
    console.log(`Temporizador iniciado para: ${this.currentPlayer?.name}`);
    
    this.turnTimerSub = timer(0, 1000).subscribe(() => {
      this.timeRemaining--;
      
      if (this.timeRemaining <= 0) {
        console.log('Tiempo agotado!');
        this.turnTimerSub.unsubscribe();
        this.onTurnTimeout();
      }
    });
    }
  private handleTurnTimeout(playerId: number): void {
    if (playerId === this.currentPlayer?.id) {
      alert('Se te ha agotado el tiempo!');
      this.passTurn();
    }
  }
  private passTurn(): void {
    this.websocketService.sendRxjs(JSON.stringify({
      type: 'passTurn',
      gameId: this.websocketService.currentGameId
    }));
  }

 
  requestRematch(): void {
    this.websocketService.sendRxjs(JSON.stringify({
      type: 'rematchRequest',
      playerId: this.currentPlayer.id,
      gameId: this.websocketService.currentGameId
    }));
  }
  get isCurrentPlayer(): boolean {
    if (!this.currentPlayer || !this.usuarioId) {
      console.log('No hay jugador actual o usuario no identificado');
      return false;
    }
  
    const isCurrent = this.currentPlayer.id === this.usuarioId && 
                      this.currentPlayer.turnsToSkip <= 0;
    
    console.log(`Comprobando turno: ${isCurrent} 
      (Usuario ID: ${this.usuarioId}, Current Player ID: ${this.currentPlayer.id}, 
      TurnsToSkip: ${this.currentPlayer.turnsToSkip})`);
    
    return isCurrent;
  }
    

  onTurnTimeout(): void {
    // Notificar al servidor que se ha agotado el tiempo del turno para el jugador actual
    this.websocketService.sendRxjs(JSON.stringify({
      type: 'turnTimeout',
      playerId: this.currentPlayer.id,
      gameId: this.websocketService.currentGameId
    }));
    // Mostrar mensaje en la UI
    this.moveMessage = 'Tiempo agotado. Has perdido el turno.';
    this.showMoveMessage = true;
    setTimeout(() => { this.showMoveMessage = false; }, 5000);
  }

  // Función para abandonar la partida online
  public abandonGame(): void {
    this.websocketService.sendRxjs(JSON.stringify({
      type: 'abandonGame',
      gameId: this.websocketService.currentGameId
    }));
    this.router.navigate(['/menu']);
  }
  private handleOpponentAbandoned(): void {
    this.gameOver = true;
    this.winnerName = this.usuarioApodo;
    alert('Tu oponente ha abandonado la partida!');
  }
  // Función para lanzar el dado
  public rollDice(): void {
    if (this.isCurrentPlayer) {
      this.websocketService.rollDice();
      this.startTurnTimer();
    }
  }

  // Métodos del chat
  sendMessage(): void {
    if (!this.newMessage.trim()) return;
    const sender = this.usuarioApodo;
    this.websocketService.sendRxjs(JSON.stringify({
      type: 'chatMessage',
      sender: sender,
      text: this.newMessage
    }));
    this.newMessage = '';
  }

  scrollChatToBottom(): void {
    try {
      this.chatMessagesContainer.nativeElement.scrollTop = this.chatMessagesContainer.nativeElement.scrollHeight;
    } catch (err) { }
  }

  // Inicializa el tablero con 63 casillas y asigna su tipo
  initializeBoard(): void {
    this.cells = [];
    for (let i = 1; i <= 63; i++) {
      this.cells.push({ number: i, type: this.getCellType(i) });
    }
  }

  // Determina el tipo de cada casilla
  getCellType(cellNumber: number): string {
    if (cellNumber === 1) return 'Inicio';
    if ([2, 3, 4, 28, 29, 30, 47, 48, 49, 60].includes(cellNumber)) return 'FlechaDerecha';
    if ([7, 8, 10, 11, 13, 33, 34, 35, 37, 51, 61].includes(cellNumber)) return 'FlechaArriba';
    if ([15, 16, 17, 20, 38, 39, 40, 55, 56, 62].includes(cellNumber)) return 'FlechaIzquierda';
    if ([21, 22, 24, 25, 43, 44, 46, 57].includes(cellNumber)) return 'FlechaAbajo';
    if ([5, 9, 14, 18, 23, 27, 32, 36, 41, 45, 50, 54, 59, 63].includes(cellNumber)) return 'Oca';
    if ([6, 12].includes(cellNumber)) return 'Puente';
    if (cellNumber === 19) return 'Posada';
    if ([26, 53].includes(cellNumber)) return 'Dados';
    if (cellNumber === 31) return 'Pozo';
    if (cellNumber === 42) return 'Laberinto';
    if (cellNumber === 52) return 'Carcel';
    if (cellNumber === 58) return 'Muerte';
    return 'Normal';
  }

  // Calcula la posición (x, y) de cada celda en el tablero
  getCellPosition(cellNumber: number): { x: number, y: number } {
    const cellSize = 60; // Tamaño de la celda
    const boardSize = 9; // Tablero de 9x9
    const centerX = (boardSize * cellSize) / 2;
    const centerY = (boardSize * cellSize) / 2;
    const spiralPosition = this.calculateInverseSpiralPosition(cellNumber, boardSize);
    const x = centerX + spiralPosition.x * cellSize;
    const y = centerY + spiralPosition.y * cellSize;
    return { x, y };
  }

  // Lógica para calcular la posición en espiral invertida
  calculateInverseSpiralPosition(cellNumber: number, boardSize: number): { x: number, y: number } {
    const invertedCellNumber = 64 - cellNumber;
    let x = 0, y = 0;
    let direction = 0; // 0: derecha, 1: abajo, 2: izquierda, 3: arriba
    let stepCount = 0;
    let stepSize = 1;
    for (let i = 1; i < invertedCellNumber; i++) {
      if (direction === 0) x++;
      else if (direction === 1) y++;
      else if (direction === 2) x--;
      else if (direction === 3) y--;
      stepCount++;
      if (stepCount === stepSize) {
        stepCount = 0;
        direction = (direction + 1) % 4;
        if (direction === 0 || direction === 2) stepSize++;
      }
    }
    return { x, y };
  }

  // Muestra el modal de fin de partida y pregunta por revancha
  showGameOverModal(winnerName: string, scores: any): void {
    const rematch = confirm(
      `El juego ha terminado.\nGanador: ${winnerName}\nPuntuaciones: ${JSON.stringify(scores)}\n¿Desean jugar una revancha?`
    );
    if (rematch) {
      // Envía solicitud de revancha al servidor
      this.websocketService.sendRxjs(JSON.stringify({
        type: 'rematchRequest',
        playerId: this.currentPlayer.id,
        gameId: this.websocketService.currentGameId
      }));
    } else {
      this.router.navigate(['/menu']);
    }
  }

  // Reinicia el estado del juego en caso de revancha aceptada
  restartGame(): void {
    this.gameOver = false;
    this.initializeBoard();
    this.startTurnTimer();
    // Opcional: reiniciar estado de jugadores, resultados y demás variables según la lógica del juego
  }

  // Carga la información del usuario autenticado
  cargarInfoUsuario(): void {
    const userInfo = this.authService.getUserDataFromToken();
    if (userInfo) {
      this.usuarioApodo = userInfo.name;
      this.usuarioFotoPerfil = userInfo.profilePicture
        ? `${userInfo.apiUrl}/fotos/${userInfo.profilePicture}`
        : 'default.png';
      this.usuarioId = userInfo.id;
      this.websocketService.currentGameId = userInfo.currentGameId;
    } else {
      this.router.navigate(['/login']);
    }
  }

  ngOnDestroy(): void {
    this.turnTimerSub?.unsubscribe();
  }
}

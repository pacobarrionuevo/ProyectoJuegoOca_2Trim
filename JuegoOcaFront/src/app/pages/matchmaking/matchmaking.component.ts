import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ImageService } from '../../services/image.service';
import { WebsocketService } from '../../services/websocket.service';

@Component({
  selector: 'app-matchmaking',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './matchmaking.component.html',
  styleUrl: './matchmaking.component.css'
})
export class MatchmakingComponent {
  tablero: string;
  ROB: string;
  NinosJugandoALaOca : string;
  estadoPartida: string = 'buscando';
  amigoInvitado: any = null; // Información del amigo invitado
  oponente: any = null;
  constructor(private imageService: ImageService, private websocketService: WebsocketService, private router : Router) {
      this.tablero = this.imageService.getImageUrl('TableroJuego.png');
      this.ROB = this.imageService.getImageUrl('ROB.jpg')
      this.NinosJugandoALaOca = this.imageService.getImageUrl('NiñosJugandoALaOca.jpg')
    }
    ngOnInit(): void {
      // Escuchar mensajes del WebSocket
      this.websocketService.messageReceived.subscribe((message: any) => {
        if (message.type === 'invitationAccepted') {
          this.estadoPartida = 'partidaEnCurso';
          this.oponente = { UsuarioApodo: message.friendNickname }; // Obtener el apodo del amigo
        } else if (message.type === 'gameStarted') {
          this.estadoPartida = 'partidaEnCurso';
          this.oponente = { UsuarioApodo: message.opponentNickname }; // Obtener el apodo del oponente
        } else if (message.type === 'botGameStarted') {
          this.estadoPartida = 'partidaConBot';
        }
      });
    }
  
    /**
     * Cancelar la búsqueda de oponente.
     */
    cancelarBusqueda() {
      this.websocketService.sendRxjs(JSON.stringify({ type: 'cancelSearch' }));
      this.estadoPartida = 'inactivo';
      this.router.navigate(['/menu']);
    }
  
    /**
     * Abandonar la partida actual.
     */
    abandonarPartida() {
      this.websocketService.sendRxjs(JSON.stringify({ type: 'leaveGame' }));
      this.estadoPartida = 'inactivo';
      this.router.navigate(['/menu']);
    }}
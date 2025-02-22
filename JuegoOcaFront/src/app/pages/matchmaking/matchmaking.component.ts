import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ImageService } from '../../services/image.service';
import { WebsocketService } from '../../services/websocket.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-matchmaking',
  standalone: true,
  imports: [RouterLink, CommonModule],
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
  constructor(private imageService: ImageService, private webSocketService: WebsocketService, private router : Router) {
      this.tablero = this.imageService.getImageUrl('TableroJuego.png');
      this.ROB = this.imageService.getImageUrl('ROB.jpg')
      this.NinosJugandoALaOca = this.imageService.getImageUrl('NiñosJugandoALaOca.jpg')
    }
    ngOnInit(): void {
      // Escuchar mensajes del WebSocket
      this.webSocketService.messageReceived.subscribe((message: any) => {
        if (message.Type === 'gameStarted') {
          this.estadoPartida = 'partidaEnCurso';
          this.oponente = { UsuarioApodo: `Usuario ${message.Opponent}` }; // Obtener el apodo del oponente
        } else if (message.Type === 'waitingForOpponent') {
          this.estadoPartida = 'buscando';
        } else if (message.Type === 'searchCancelled') {
          this.estadoPartida = 'inactivo';
        } else if (message.Type === 'botGameStarted') {
          this.estadoPartida = 'partidaConBot';
        }
      });
    }
  
    /**
     * Jugar con amigos.
     */
    jugarConAmigos() {
      this.estadoPartida = 'buscando';
      const message = {
        type: 'inviteFriend'
      };
      this.webSocketService.sendRxjs(JSON.stringify(message));
    }
  
    /**
     * Jugar con un bot.
     */
    jugarConBot() {
      this.estadoPartida = 'partidaConBot';
      const message = {
        type: 'playWithBot'
      };
      this.webSocketService.sendRxjs(JSON.stringify(message));
    }
  
    /**
     * Buscar un oponente aleatorio.
     */
    jugarAleatorio() {
      this.estadoPartida = 'buscando';
      const message = {
        type: 'playRandom'
      };
      this.webSocketService.sendRxjs(JSON.stringify(message));
    }
  
    /**
     * Cancelar la búsqueda de oponente.
     */
    cancelarBusqueda() {
      const message = {
        type: 'cancelSearch'
      };
      this.webSocketService.sendRxjs(JSON.stringify(message));
      this.estadoPartida = 'inactivo';
    }
  
    /**
     * Abandonar la partida actual.
     */
    abandonarPartida() {
      const message = {
        type: 'leaveGame'
      };
      this.webSocketService.sendRxjs(JSON.stringify(message));
      this.estadoPartida = 'inactivo';
      this.router.navigate(['/menu']);
    }
  }
import { Component, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { WebsocketService } from '../../services/websocket.service';
import { CommonModule } from '@angular/common';
import { ImageService } from '../../services/image.service';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
@Component({
  selector: 'app-matchmaking',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './matchmaking.component.html',
  styleUrls: ['./matchmaking.component.css']
})
export class MatchmakingComponent implements OnDestroy {
  // Variables de estado
  estado: 'inactivo' | 'buscando' | 'enPartida' = 'inactivo';
  jugadoresEnCola = 0;
  oponenteId: number | null = null;
  gameId: string | null = null;

  // Rutas de imágenes
  tablero: string;
  ROB: string;
  NinosJugandoALaOca: string;

  constructor(
    private imageService: ImageService,
    private wsService: WebsocketService,
    private router: Router
  ) {
    // Inicializar imágenes
    this.tablero = this.imageService.getImageUrl('TableroJuego.png');
    this.ROB = this.imageService.getImageUrl('ROB.jpg');
    this.NinosJugandoALaOca = this.imageService.getImageUrl('NiñosJugandoALaOca.jpg');

    // Suscripción a mensajes WebSocket
    this.wsService.messageReceived.subscribe((msg: any) => {
      if (msg.type === 'gameReady') {
        this.handleGameReady(msg);
      } else if (msg.type === 'waitingStatus') {
        this.handleWaitingStatus(msg);
      }
    });
  }

  // Manejar inicio de partida
  private handleGameReady(msg: any): void {
    this.estado = 'enPartida';
    this.gameId = msg.gameId;
    this.oponenteId = msg.opponentId;
  
    // Navegar inmediatamente sin delay
    this.router.navigate(['/game-online'], {
      state: {
        gameId: this.gameId,
        opponentId: this.oponenteId
      }
    });
  }

  // Actualizar estado de la cola
  private handleWaitingStatus(msg: any): void {
    this.jugadoresEnCola = msg.playersInQueue;
  }

  // Iniciar búsqueda de partida
  buscarPartida(tipo: 'random' | 'bot' | 'amigos'): void {
    this.estado = 'buscando';
    const messageType = this.getMessageType(tipo);
    this.wsService.sendRxjs(JSON.stringify({ type: messageType }));
  }

  // Mapear tipos de búsqueda
  private getMessageType(tipo: string): string {
    return {
      'random': 'playRandom',
      'bot': 'playWithBot',
      'amigos': 'inviteFriend'
    }[tipo] || 'playRandom';
  }

  // Cancelar búsqueda
  cancelarBusqueda(): void {
    this.estado = 'inactivo';
    this.wsService.sendRxjs(JSON.stringify({ type: 'cancelSearch' }));
  }

  // Limpieza al destruir el componente
  ngOnDestroy(): void {
    if (this.estado === 'buscando') {
      this.cancelarBusqueda();
    }
  }
}
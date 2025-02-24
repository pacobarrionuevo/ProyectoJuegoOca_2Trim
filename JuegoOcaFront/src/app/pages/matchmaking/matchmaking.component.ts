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
  NinosJugandoALaOca: string;
  estadoPartida: string = 'inactivo';
  oponente: any = null;
  gameId: string | null = null;

  constructor(
    private imageService: ImageService,
    private webSocketService: WebsocketService,
    private router: Router
  ) {
    this.tablero = this.imageService.getImageUrl('TableroJuego.png');
    this.ROB = this.imageService.getImageUrl('ROB.jpg');
    this.NinosJugandoALaOca = this.imageService.getImageUrl('NiñosJugandoALaOca.jpg');
  }

  ngOnInit(): void {
    this.webSocketService.messageReceived.subscribe((message: any) => {
      if (message.Type === 'gameReady') {
        this.estadoPartida = 'partidaLista';
        this.oponente = { UsuarioApodo: message.Opponent };
        this.gameId = message.GameId;

        setTimeout(() => {
          this.router.navigate(['/game'], { state: { gameId: this.gameId } });
        }, 3000);
      } else if (message.Type === 'waitingForOpponent') {
        this.estadoPartida = 'buscando';
      }
    });
  }

  jugarConAmigos() {
    this.estadoPartida = 'buscando';
    const message = { type: 'inviteFriend' };
    this.webSocketService.sendRxjs(JSON.stringify(message));
  }

  jugarConBot() {
    this.estadoPartida = 'buscando';
    const message = { type: 'playWithBot' };
    this.webSocketService.sendRxjs(JSON.stringify(message));
  }

  jugarAleatorio() {
    this.estadoPartida = 'buscando';
    const message = { type: 'playRandom' };
    this.webSocketService.sendRxjs(JSON.stringify(message));
  }

  cancelarBusqueda() {
    const message = { type: 'cancelSearch' };
    this.webSocketService.sendRxjs(JSON.stringify(message));
    this.estadoPartida = 'inactivo';
  }
}
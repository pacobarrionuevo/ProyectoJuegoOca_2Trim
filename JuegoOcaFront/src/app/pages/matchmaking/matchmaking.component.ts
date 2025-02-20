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
  constructor(private imageService: ImageService, private websocketService: WebsocketService) {
      this.tablero = this.imageService.getImageUrl('TableroJuego.png');
      this.ROB = this.imageService.getImageUrl('ROB.jpg')
      this.NinosJugandoALaOca = this.imageService.getImageUrl('NiñosJugandoALaOca.jpg')
    }
    jugarConAmigos() {
     
      this.websocketService.sendRxjs(JSON.stringify({ type: 'inviteFriend' }));
    }
  
    jugarConBot() {
      
      this.websocketService.sendRxjs(JSON.stringify({ type: 'playWithBot' }));
    }
  
    jugarAleatorio() {
      
      this.websocketService.sendRxjs(JSON.stringify({ type: 'playRandom' }));
    }
}

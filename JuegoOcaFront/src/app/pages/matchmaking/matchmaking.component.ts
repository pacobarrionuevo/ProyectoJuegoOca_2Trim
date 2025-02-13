import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ImageService } from '../../services/image.service';

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
  constructor(private imageService: ImageService) {
      this.tablero = this.imageService.getImageUrl('TableroJuego.png');
      this.ROB = this.imageService.getImageUrl('ROB.jpg')
      this.NinosJugandoALaOca = this.imageService.getImageUrl('NiñosJugandoALaOca.jpg')
    }
  
}

import { Component } from '@angular/core';
import { ImageService } from '../../services/image.service';
import { RouterModule } from '@angular/router';
@Component({
  selector: 'app-main',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './main.component.html',
  styleUrl: './main.component.css'
})
export class MainComponent {
  cubileteDados: string;
  tablero: string;
  fondo: string;
  

  constructor(private imageService: ImageService) {
    this.cubileteDados = this.imageService.getImageUrl('CubileteDados.png');
    this.tablero = this.imageService.getImageUrl('TableroJuego.png');
    this.fondo = this.imageService.getImageUrl('FondoPagina.jpg');
  }
}


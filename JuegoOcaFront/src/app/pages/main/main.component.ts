import { Component } from '@angular/core';
import { ImageService } from '../../services/image.service';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
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
  router: any;
  

  constructor(private imageService: ImageService, private authService : AuthService) {
    this.cubileteDados = this.imageService.getImageUrl('CubileteDados.png');
    this.tablero = this.imageService.getImageUrl('TableroJuego.png');
    this.fondo = this.imageService.getImageUrl('FondoPagina.jpg');
    //logout() { this.authService.logout(); this.router.navigate(['/login']); // Redirige al usuario a la página de login tras cerrar sesión }
  }
}


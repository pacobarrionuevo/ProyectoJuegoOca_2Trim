import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { ImageService } from '../../services/image.service';
import { AuthService } from '../../services/auth.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-main',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.css']
})
export class MainComponent implements OnInit {
  cubileteDados: string;
  tablero: string;
  fondo: string;
  isLoggedIn: boolean = false;

  constructor(private imageService: ImageService, private authService: AuthService, private router: Router) {
    this.cubileteDados = this.imageService.getImageUrl('CubileteDados.png');
    this.tablero = this.imageService.getImageUrl('TableroJuego.png');
    this.fondo = this.imageService.getImageUrl('FondoPagina.jpg');
  }

  ngOnInit(): void {
    this.authService.isLoggedIn$.subscribe(loggedIn => {
      this.isLoggedIn = loggedIn;
    });
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']); // Redirige al usuario a la página de login tras cerrar sesión
  }
}

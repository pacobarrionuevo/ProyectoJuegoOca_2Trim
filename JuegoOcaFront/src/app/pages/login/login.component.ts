import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { AuthRequest } from '../../models/auth-request';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [RouterModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  emailoapodo: string = '';
  contrasena: string = '';
  jwt: string | null = null; 
  usuarioId: number | null = null;

  constructor(private authService: AuthService, private router: Router) {}

  ngOnInit(): void {
    // Obtenemos el token desde el almacenamiento local en OnInit
    this.jwt = localStorage.getItem('accessToken'); 
  }

  async submit() {
    const authData: AuthRequest = { emailoapodo: this.emailoapodo, contrasena: this.contrasena };
    try {
      const result = await this.authService.login(authData).toPromise();

      if (result) {
        // Guarda el token y el ID del usuario en el localStorage
        localStorage.setItem('accessToken', result.stringToken); 
        localStorage.setItem('usuarioId', result.usuarioId.toString()); 

        // Asigna el token y el ID a las variables locales
        this.jwt = result.stringToken;
        this.usuarioId = result.usuarioId;

        console.log("Inicio de sesión exitoso.");
        this.router.navigate(['/']);
      } else {
        console.error("No se recibió un token de acceso.");
      }
    } catch (error) {
      console.error("Error al iniciar sesión:", error);
    }
  }
}

import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { AuthRequest } from '../../models/auth-request';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [RouterModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  emailoapodo: string = '';
  contrasena: string = '';
  remember: boolean = false;
  jwt: string | null = null; 
  usuarioId: number | null = null;

  constructor(private authService: AuthService, private router: Router) {}

  ngOnInit(): void {
    const savedAuthData = JSON.parse(localStorage.getItem('authData') || '{}');
    if (savedAuthData.recuerdame) {
      this.emailoapodo = savedAuthData.emailoapodo || '';
      this.contrasena = savedAuthData.contrasena || '';
      this.remember = savedAuthData.remember || false;
    }

    this.jwt = localStorage.getItem('accessToken'); 
  }

  async submit() {
    const authData: AuthRequest = { 
      UsuarioEmailOApodo: this.emailoapodo, 
      UsuarioContrasena: this.contrasena 
    };

    try {
      const result = await this.authService.login(authData).toPromise();
      if (result) {
        if (this.remember) {
          localStorage.setItem('authData', JSON.stringify({
            emailoapodo: this.emailoapodo,
            contrasena: this.contrasena,
            recuerdame: this.remember
          }));
        } else {
          localStorage.removeItem('authData');
        }
        localStorage.setItem('accessToken', result.stringToken);
        localStorage.setItem('usuarioId', result.usuarioId.toString());
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

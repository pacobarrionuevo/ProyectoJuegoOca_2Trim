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
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  emailoapodo: string = '';
  contrasena: string = '';
  recuerdame: boolean = false;
  jwt: string | null = null; 

  constructor(
    private authService: AuthService, 
    private router: Router
  ) {}

  ngOnInit(): void {
    const savedAuthData = JSON.parse(localStorage.getItem('authData') || '{}');
    if (savedAuthData.recuerdame) {
      this.emailoapodo = savedAuthData.emailoapodo || '';
      this.contrasena = savedAuthData.contrasena || '';
      this.recuerdame = savedAuthData.recuerdame || false;
    }
  }

  async submit() {
    const authData: AuthRequest = { 
      UsuarioEmailOApodo: this.emailoapodo, 
      UsuarioContrasena: this.contrasena 
    };

    try {
      await this.authService.login(authData, this.recuerdame).toPromise();

      if (this.recuerdame) {
        localStorage.setItem('authData', JSON.stringify({
          emailoapodo: this.emailoapodo,
          contrasena: this.contrasena,
          recuerdame: this.recuerdame
        }));
      } else {
        localStorage.removeItem('authData');
      }

      this.router.navigate(['/menu']);
    } catch (error: any) {
      if (error.status === 400 && error.error.message === "Usuario baneado") {
        alert("Usuario baneado: No puedes iniciar sesión.");
      } else {
        console.error("Error al iniciar sesión:", error);
      }
    }
  }
}
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { AuthRequest } from '../../models/auth-request';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [RouterModule, FormsModule],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css'
})
export class RegisterComponent {
  apodo: string = '';
  email: string = '';
  contrasena: string = '';
  confirmar_contrasena: string = '';
  foto_perfil: string = '';
  jwt: string | null = null; 

  constructor(private authService: AuthService, private router: Router) {}

  ngOnInit(): void {
    this.jwt = localStorage.getItem('accessToken'); 
  }

  async submit() {
    const authData: AuthRequest = {
      UsuarioApodo: this.apodo,
      UsuarioEmail: this.email,
      UsuarioContrasena: this.contrasena,
      UsuarioConfirmarContrasena: this.confirmar_contrasena,
      UsuarioFotoPerfil: this.foto_perfil
    };

    try {
      const result = await this.authService.register(authData).toPromise();
      if (result) {
        localStorage.setItem('accessToken', result.stringToken);
        this.jwt = result.stringToken;
        console.log("Registro exitoso.");
        this.router.navigate(['/login']);
      } else {
        console.error("No se recibió un token de acceso.");
      }
    } catch (error) {
      console.error("Error al registrar:", error);
    }
  }
}
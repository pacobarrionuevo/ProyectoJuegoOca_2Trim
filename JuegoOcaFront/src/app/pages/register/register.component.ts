import { Component } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

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
  UsuarioContrasena: string = '';
  confirmar_contrasena: string = '';
  foto_perfil: string = '';
  jwt: string = '';

  constructor (private authService: AuthService, private router: Router) {}

  async submit() {
    const authData = {
      apodo: this.apodo,
      email: this.email,
      UsuarioContrasena: this.UsuarioContrasena,
      confirmar_contrasena: this.confirmar_contrasena,
      foto_perfil: this.foto_perfil
    };
    
    console.log(authData);
    const result = await this.authService.register(authData).toPromise();

    if (result) {
      this.jwt = result.stringToken;
      this.router.navigate(['/login']);
    }
  }
}


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
  UsuarioApodo: string = '';
  UsuarioEmail: string = '';
  UsuarioContrasena: string = '';
  UsuarioConfirmarContrasena: string = '';
  UsuarioFotoPerfil: string = '';
  jwt: string = '';

  constructor (private authService: AuthService, private router: Router) {}

  async submit() {
    const authData = {
      UsuarioApodo: this.UsuarioApodo,
      UsuarioEmail: this.UsuarioEmail,
      UsuarioContrasena: this.UsuarioContrasena,
      UsuarioConfirmarContrasena: this.UsuarioConfirmarContrasena,
      UsuarioFotoPerfil: this.UsuarioFotoPerfil
    };
    
    console.log(authData);
    const result = await this.authService.register(authData).toPromise();

    if (result) {
      this.jwt = result.stringToken;
      this.router.navigate(['/login']);
    }
  }
}


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
  //pasar id
  apodo: string = '';
  email: string = '';
  password: string = '';
  confirmar_password: string = '';
  foto_perfil: string = '';
  jwt: string = '';

  constructor (private authService: AuthService, private router: Router) {}

  async submit() {
    const authData = {
      apodo: this.apodo,
      email: this.email,
      password: this.password,
      confirmar_password: this.confirmar_password
    };

    const result = await this.authService.register(authData).toPromise();

    if (result) {
      this.jwt = result.stringToken;
      this.router.navigate(['/login']);
    }
  }
}


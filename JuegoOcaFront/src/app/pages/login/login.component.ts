import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';


@Component({
  selector: 'app-login',
  standalone: true,
  imports: [RouterModule,FormsModule,],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
emailoapodo: string ='';
contrasena: string ='';
jwt: string | null = null; 
usuarioId: number | null = null;

constructor(private authService: AuthService, private router: Router) {}

ngOnInit(): void {
  // Obtenemos el token desde el almacenamiento local en OnInit
  this.jwt = localStorage.getItem('accessToken'); 
}
async submit(){
  const authData ={emailoapodo: this.emailoapodo,contrasena:this.contrasena}
}
}

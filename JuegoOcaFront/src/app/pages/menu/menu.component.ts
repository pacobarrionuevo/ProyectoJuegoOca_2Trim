import { Component, OnInit } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { User } from '../../models/User';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-menu',
  templateUrl: './menu.component.html',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  styleUrls: ['./menu.component.css']
})
export class MenuComponent implements OnInit {
  usuarios: User[] = []; 
  usuariosFiltrados: User[] = [];
  terminoBusqueda: string = '';
  
  amigos: User[] = []; 
  amigosFiltrados: User[] = [];
  busquedaAmigos: string = '';
  
  vistaActiva: string = 'amigos'; 

  usuarioApodo: string = ''; 
  usuarioFotoPerfil: string = '';

  constructor(private apiService: ApiService, private authService: AuthService, private router: Router) { }

  ngOnInit(): void {
    this.obtenerUsuarios();
    this.cargarInfoUsuario(); 
  }

  async obtenerUsuarios(): Promise<void> {
    const result = await this.apiService.getUsuarios();
    if (result.isSuccess()) {
      this.usuarios = result.getData() || []; 
      this.usuariosFiltrados = this.usuarios; 
    } else {
      console.error('Error al obtener usuarios:', result.getError());
    }
  }

  buscarUsuarios(): void {
    if (this.terminoBusqueda) {
      this.usuariosFiltrados = this.usuarios.filter(usuario =>
        usuario.UsuarioApodo.toLowerCase().includes(this.terminoBusqueda.toLowerCase())
      );
    } else {
      this.usuariosFiltrados = this.usuarios;
    }
  }

  cambiarVista(vista: string): void {
    this.vistaActiva = vista;
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']); 
  }

  cargarInfoUsuario(): void {
    const userInfo = this.authService.getUserDataFromToken();
    if (userInfo) {
      this.usuarioApodo = userInfo.name;
      this.usuarioFotoPerfil = `${environment.apiUrl}/fotos/${userInfo.profilePicture}`; 
    } else {
      console.error('No se pudo obtener la información del usuario desde el token.');
    }
  }
}
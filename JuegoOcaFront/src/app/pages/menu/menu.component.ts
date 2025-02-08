import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { WebsocketService } from '../../services/websocket.service';
import { FormsModule } from '@angular/forms';
import { User } from '../../models/User';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-menu',
  standalone: true,
  templateUrl: './menu.component.html',
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
  
  solicitudesPendientes: any[] = []; 

  vistaActiva: string = 'amigos'; 

  usuarioApodo: string = ''; 
  usuarioFotoPerfil: string = '';
  usuarioId: number | null = null; 

  constructor(
    private webSocketService: WebsocketService, 
    private apiService: ApiService, 
    private authService: AuthService, 
    private router: Router
  ) { }

  ngOnInit(): void {
    this.obtenerUsuarios();
    this.cargarInfoUsuario(); 
    this.cargarAmigos();
    this.cargarSolicitudesPendientes();
  }

  getFotoPerfilUrl(fotoPerfil: string | undefined): string {
    return fotoPerfil ? `${environment.apiUrl}/fotos/${fotoPerfil}` : 'default-image-path';
  }

  obtenerUsuarios(): void { 
    this.apiService.getUsuarios().subscribe(usuarios => {
      this.usuarios = usuarios.map(usuario => ({
        UsuarioApodo: usuario.usuarioApodo,
        UsuarioFotoPerfil: usuario.usuarioFotoPerfil
          ? `${environment.apiUrl}/fotos/${usuario.usuarioFotoPerfil}`
          : 'assets/default-profile.png' 
      }));
      console.log(this.usuarios);
      this.usuariosFiltrados = [...this.usuarios]; 
    });
  }

  buscarUsuarios(): void {
    if (this.terminoBusqueda.trim() !== '') {
      this.usuariosFiltrados = this.usuarios.filter(usuario => 
        usuario.UsuarioApodo?.toLowerCase().includes(this.terminoBusqueda.toLowerCase())
      );
    } else {
      this.usuariosFiltrados = [...this.usuarios];
    }
  }

  enviarSolicitud(receiverId: number): void {
    if (this.usuarioId === null) {
      console.error('Usuario no autenticado.');
      return;
    }
  
    this.apiService.sendFriendRequest(this.usuarioId, receiverId).subscribe({
      next: () => {
        console.log('Solicitud de amistad enviada con éxito.');
        this.cargarSolicitudesPendientes();
      },
      error: (error) => {
        console.error('Error al enviar la solicitud de amistad:', error);
      }
    });
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  cargarInfoUsuario(): void {
    const userInfo = this.authService.getUserDataFromToken();
    if (userInfo) {
      this.usuarioApodo = userInfo.name;
      this.usuarioFotoPerfil = this.getFotoPerfilUrl(userInfo.profilePicture); 
      this.usuarioId = userInfo.id; 
    } else {
      console.error('No se pudo obtener la información del usuario desde el token.');
    }
    console.log(userInfo);
  }

  cargarAmigos(): void {
    if (this.usuarioId) {
      this.apiService.getFriendsList(this.usuarioId).subscribe(amigos => {
        this.amigos = amigos.map(amigo => ({
          UsuarioApodo: amigo.UsuarioApodo,
          UsuarioFotoPerfil: amigo.UsuarioFotoPerfil
        }));
        this.amigosFiltrados = this.amigos;
      });
    }
  }

  cargarSolicitudesPendientes(): void {
    if (this.usuarioId) {
      this.apiService.getPendingFriendRequests(this.usuarioId).subscribe(solicitudes => {
        this.solicitudesPendientes = solicitudes;
      });
    }
  }

  async aceptarSolicitud(amistadId: number): Promise<void> {
    try {
      const resultado = await this.apiService.post(`/api/FriendRequest/accept`, { amistadId });
      console.log('Respuesta del servidor:', resultado);
      if (resultado.success) {
        this.cargarSolicitudesPendientes();
        this.cargarAmigos();
      } else {
        console.error('Error al aceptar la solicitud:', resultado['errorMessage']);
      }
    } catch (error) {
      console.error('Error en la solicitud de aceptación:', error);
    }
  }

  async rechazarSolicitud(amistadId: number): Promise<void> {
    try {
      const resultado = await this.apiService.post(`/api/FriendRequest/reject`, { amistadId });
      if (resultado.success) {
        this.cargarSolicitudesPendientes();
      } else {
        console.error('Error al rechazar la solicitud:', resultado['errorMessage']);
      }
    } catch (error) {
      console.error('Error en la solicitud de rechazo:', error);
    }
  }
}

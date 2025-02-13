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
import { ImageService } from '../../services/image.service';

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

  usuarioApodo: string = ''; 
  usuarioFotoPerfil: string = '';
  usuarioId: number | null = null;
  perfil_deffault: string; 

  constructor(
    private webSocketService: WebsocketService, 
    private apiService: ApiService, 
    private authService: AuthService, 
    private router: Router,
    private imageService: ImageService
    
  ) { 
    this.perfil_deffault = this.imageService.getImageUrl('Perfil_Deffault.png');
  }

  ngOnInit(): void {
    this.obtenerUsuarios();
    this.cargarInfoUsuario(); 
    this.cargarAmigos();
    this.cargarSolicitudesPendientes();

    this.webSocketService.messageReceived.subscribe((message: any) => {
      console.log("Mensaje recibido de WebSocket:", message);
      if (message.FriendId) {
        this.actualizarEstadoAmigo(message.FriendId, message.Estado);
      }
    });
  }

  actualizarEstadoAmigo(friendId: number, estado: string) {
    const amigo = this.amigos.find(a => a.UsuarioId === friendId);
    if (amigo) {
      amigo.UsuarioEstado = estado;
    }
  }

  getFotoPerfilUrl(fotoPerfil: string): string {
    return `${environment.apiUrl}/fotos/${fotoPerfil}`;
  }

  obtenerUsuarios(): void {
    this.apiService.getUsuarios().subscribe(usuarios => {
      this.usuarios = usuarios.map(usuario => ({
        UsuarioApodo: usuario.usuarioApodo,
        UsuarioFotoPerfil: this.validarUrlImagen(usuario.usuarioFotoPerfil)
      }));
      this.usuariosFiltrados = [...this.usuarios];
    });
  }
  
  validarUrlImagen(fotoPerfil: string | null): string {
    if (fotoPerfil) {
      return `${environment.apiUrl}/fotos/${fotoPerfil}`;
    }
    return `${environment.apiUrl}/images/Perfil_Deffault.png`;

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

    this.apiService.sendFriendRequest(this.usuarioId).subscribe({
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
      this.usuarioFotoPerfil = `${environment.apiUrl}/fotos/${userInfo.profilePicture}`; 
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
          UsuarioApodo: amigo.usuarioApodo,
          UsuarioFotoPerfil: amigo.usuarioFotoPerfil
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
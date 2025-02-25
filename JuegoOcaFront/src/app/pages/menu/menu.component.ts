import { Component, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { WebsocketService } from '../../services/websocket.service';
import { FormsModule } from '@angular/forms';
import { User } from '../../models/User';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';
import { CommonModule } from '@angular/common';
import { ImageService } from '../../services/image.service';
import { SolicitudAmistad } from '../../models/solicitud-amistad';
import { FriendService } from '../../services/friend.service';

@Component({
  selector: 'app-menu',
  standalone: true,
  templateUrl: './menu.component.html',
  imports: [CommonModule, FormsModule, RouterLink],
  styleUrls: ['./menu.component.css']
})
export class MenuComponent implements OnInit {
  usuarios: User[] = [];
  usuariosFiltrados: User[] = [];
  terminoBusqueda: string = '';

  amigos: User[] = [];
  amigosFiltrados: User[] = [];
  busquedaAmigos: string = '';

  solicitudesPendientes: SolicitudAmistad[] = [];

  usuarioApodo: string = '';
  usuarioFotoPerfil: string = '';
  usuarioId: number | null = null;
  perfil_default: string;

  constructor(
    private webSocketService: WebsocketService,
    private apiService: ApiService,
    private authService: AuthService,
    private router: Router,
    private imageService: ImageService,
    private friendService: FriendService
  ) {
    this.perfil_default = this.imageService.getImageUrl('Perfil_Deffault.png');
  }

  ngOnInit(): void {
    this.obtenerUsuarios();
    this.cargarInfoUsuario();
    this.cargarAmigos();
    this.obtenerSolicitudesPendientes();

    this.webSocketService.messageReceived.subscribe((message: any) => {
      if (message.FriendId) {
        this.actualizarEstadoAmigo(message.FriendId, message.Estado);
      }
    });
  }

  actualizarEstadoAmigo(friendId: number, estado: string): void {
    const amigo = this.amigos.find(a => a.UsuarioId === friendId);
    if (amigo) {
      amigo.UsuarioEstado = estado;
    }
  }

  invitarAPartida(friendId: number): void {
    if (!friendId) {
      console.error('ID de amigo no válido.');
      return;
    }

    if (!this.webSocketService.isConnectedRxjs()) {
      const token = this.authService.getUserDataFromToken();
      if (token) {
        this.webSocketService.connectRxjs(token);
      } else {
        console.error('No se pudo obtener el token del usuario.');
        return;
      }
    }

    const message = {
      type: 'inviteFriend',
      friendId: friendId
    };
    this.webSocketService.sendRxjs(JSON.stringify(message));
    console.log(`Invitación enviada al amigo con ID: ${friendId}`);
  }

  obtenerUsuarios(): void {
    this.apiService.getUsuarios().subscribe(usuarios => {
      this.usuarios = usuarios.map(usuario => ({
        UsuarioId: usuario.usuarioId,
        UsuarioApodo: usuario.usuarioApodo,
        UsuarioFotoPerfil: this.validarUrlImagen(usuario.usuarioFotoPerfil)
      }));
      this.usuariosFiltrados = [...this.usuarios];
    });
  }

  validarUrlImagen(fotoPerfil: string | null): string {
    return fotoPerfil ? `${environment.apiUrl}/fotos/${fotoPerfil}` : this.perfil_default;
  }

  buscarUsuarios(): void {
    this.usuariosFiltrados = this.terminoBusqueda.trim()
      ? this.usuarios.filter(usuario =>
          usuario.UsuarioApodo?.toLowerCase().includes(this.terminoBusqueda.toLowerCase()))
      : [...this.usuarios];
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  cargarInfoUsuario(): void {
    const userInfo = this.authService.getUserDataFromToken();
    if (userInfo) {
      this.usuarioApodo = userInfo.name;
      this.usuarioFotoPerfil = this.validarUrlImagen(userInfo.profilePicture);
      this.usuarioId = userInfo.id;
    } else {
      console.error('No se pudo obtener la información del usuario.');
    }
  }

  enviarSolicitud(receiverId: number): void {
    this.friendService.sendFriendRequest(receiverId).subscribe({
      next: () => {
        console.log(`Solicitud de amistad enviada a ${receiverId}`);
        this.obtenerSolicitudesPendientes();
      },
      error: (error) => console.error('Error al enviar la solicitud:', error)
    });
  }

  obtenerSolicitudesPendientes(): void {
    this.friendService.getPendingRequests().subscribe({
      next: (solicitudes: any[]) => {
        this.solicitudesPendientes = solicitudes.map(amistadObj => {
          const otro = amistadObj.amistadUsuario.find(ua => ua.usuarioId !== this.usuarioId);
          return {
            amistadId: amistadObj.amistadId,
            usuarioId: otro ? otro.usuarioId : 0,
            usuarioApodo: otro ? this.getUsuarioApodoById(otro.usuarioId) : 'Usuario desconocido',
            usuarioFotoPerfil: otro && otro.usuario ? otro.usuario.UsuarioFotoPerfil : null
          } as SolicitudAmistad;
        });
      },
      error: (error) => console.error('Error obteniendo solicitudes:', error)
    });
  }

  getUsuarioApodoById(userId: number): string {
    const usuario = this.usuarios.find(u => u.UsuarioId === userId);
    return usuario ? usuario.UsuarioApodo : 'Usuario desconocido';
  }

  aceptarSolicitud(solicitud: SolicitudAmistad): void {
    if (!solicitud?.amistadId) {
      console.error('Solicitud no válida:', solicitud);
      return;
    }

    this.friendService.aceptarSolicitud(solicitud.amistadId).subscribe({
      next: () => {
        console.log('Solicitud aceptada');
        this.obtenerSolicitudesPendientes();
        this.cargarAmigos();
      },
      error: (err) => console.error('Error al aceptar solicitud:', err)
    });
  }

  rechazarSolicitud(solicitud: SolicitudAmistad): void {
    if (!solicitud?.amistadId) {
      console.error('Solicitud no válida:', solicitud);
      return;
    }

    this.friendService.rechazarSolicitud(solicitud.amistadId).subscribe({
      next: () => {
        console.log('Solicitud rechazada');
        this.obtenerSolicitudesPendientes();
      },
      error: (err) => console.error('Error al rechazar solicitud:', err)
    });
  }

  cargarAmigos(): void {
    this.friendService.getFriendsList().subscribe(amigos => {
      this.amigos = amigos.map(amigo => ({
        UsuarioId: amigo.usuarioId,
        UsuarioApodo: amigo.usuarioApodo,
        UsuarioFotoPerfil: this.validarUrlImagen(amigo.usuarioFotoPerfil),
        UsuarioEstado: amigo.usuarioEstado
      }));
      this.amigosFiltrados = [...this.amigos];
    });
  }
}
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
  
  usuariosConectados: Set<string> = new Set();

  solicitudesPendientes: SolicitudAmistad[] = [];

  usuarioApodo: string = '';
  usuarioFotoPerfil: string = '';
  usuarioId: number | null = null;
  perfil_default: string;
  
  activeConnections: number = 0;

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
    console.log('MenuComponent: ngOnInit() llamado');

    const token = localStorage.getItem('accessToken');
    if (token) {
      console.log('Token:', token);
      this.cargarInfoUsuario();
      this.webSocketService.connectRxjs(token); // Conectar el WebSocket si hay token
    } else {
      console.error('No hay token disponible. Redirigiendo al login...');
      this.router.navigate(['/login']); // Redirigir al login si no hay token
    }
    
    this.obtenerUsuarios();
    this.cargarInfoUsuario();
    this.cargarAmigos();
    this.obtenerSolicitudesPendientes();

    // Escuchar invitaciones
    this.webSocketService.messageReceived.subscribe((message: any) => {
      if (message.type === 'invitationReceived') {
        const aceptar = confirm(
          `${message.inviterName} te ha invitado a una partida. ¿Aceptas?`
        );
        if (aceptar) {
          this.webSocketService.sendRxjs(JSON.stringify({
            type: 'acceptInvitation',
            inviterId: message.inviterId
          }));
        }
      console.log("Mensaje recibido de WebSocket:", message);
      if (message.FriendId) {
        console.log(`MenuComponent: Actualizando estado del amigo ${message.FriendId} a ${message.Estado}`);
        this.actualizarEstadoAmigo(message.FriendId, message.Estado);
      }
    }});
  }

  invitarAPartida(friendId: number): void {
    if (friendId === this.usuarioId) {
      alert('¡No puedes invitarte a ti mismo!');
      return;
    }

    if (!this.webSocketService.isConnectedRxjs()) {
      const token = this.authService.getUserDataFromToken();
      if (token) {
        this.webSocketService.connectRxjs(token);
      }
    }

    this.webSocketService.sendRxjs(JSON.stringify({
      type: 'inviteFriend',
      friendId: friendId
    }));
  }

  // ==================================================
  // =================== NO TOCAR =====================
  // ==================================================


  // Obtiene los usuarios registrados en la BBDD --> hacer que no se muestre al que tenga la sesión iniciada
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
  
  // La foto por defecto no se hace : )

  validarUrlImagen(fotoPerfil: string | null): string {
    return fotoPerfil ? `${environment.apiUrl}/fotos/${fotoPerfil}` : this.perfil_default;
  }

  // Los amigos se buscan sin problema
  buscarUsuarios(): void {
    this.usuariosFiltrados = this.terminoBusqueda.trim()
      ? this.usuarios.filter(usuario =>
          usuario.UsuarioApodo?.toLowerCase().includes(this.terminoBusqueda.toLowerCase()))
      : [...this.usuarios];
  }

  logout(): void {
    this.authService.logout();
    this.webSocketService.clearToken();
    this.webSocketService.disconnectRxjs();
    sessionStorage.removeItem('auth_token');
    this.router.navigate(['/login']); 
    this.router.navigate(['/login']);
  }

  // La info se carga bien sin problema a no ser que tengas una foto por defecto
  cargarInfoUsuario(): void {
    const userInfo = this.authService.getUserDataFromToken();
    if (userInfo) {
      this.usuarioApodo = userInfo.name;
      this.usuarioFotoPerfil = this.validarUrlImagen(userInfo.profilePicture);
      this.usuarioId = userInfo.id;
      this.usuarioApodo = userInfo.name;
      this.usuarioFotoPerfil = this.validarUrlImagen(userInfo.profilePicture);
      this.usuarioId = userInfo.id;
    } else {
      console.error('No se pudo obtener la información del usuario. ¿El token está disponible?');
      this.router.navigate(['/login']); // Redirigir al login si no hay token
    }
  }

  // La solicitud se manda bien y sin problemas
  // --> Hacer mediante websockets D:
  enviarSolicitud(receiverId: number): void {
    this.friendService.sendFriendRequest(receiverId).subscribe({
      next: () => {
        console.log(`Solicitud de amistad enviada a ${receiverId}`);
        this.obtenerSolicitudesPendientes();
      },
      error: (error) => console.error('Error al enviar la solicitud:', error)
    });
  }
  
  // Las carga correctamente --> ¿Websockets?

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
  
  // Necesario para obtener bien las solicitudes

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
  
  // Cargan bien

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
  
  /// No entiendo para qué sirve esto
  actualizarEstadoAmigo(friendId: number, estado: string) {
    console.log(`MenuComponent: actualizarEstadoAmigo() llamado con friendId=${friendId}, estado=${estado}`);
    const amigo = this.amigos.find(a => a.UsuarioId === friendId);
    if (amigo) {
      console.log(`MenuComponent: Amigo encontrado, actualizando estado a de ${amigo.UsuarioEstado} a ${estado}`);
      amigo.UsuarioEstado = estado;
    } else {
      console.warn(`MenuComponent: No se encontró el amigo con ID ${friendId}`);
    }
  }

  // Bueno, esto se puede quedar
  private obtenerEstadoAmigo(usuarioId: string): string {
    return this.usuariosConectados.has(usuarioId) ? 'Conectado' : 'Desconectado';
  }  
}
import { ChangeDetectorRef, Component, OnInit, OnDestroy } from '@angular/core';
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
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-menu',
  standalone: true,
  templateUrl: './menu.component.html',
  imports: [CommonModule, FormsModule, RouterLink],
  styleUrls: ['./menu.component.css']
})
export class MenuComponent implements OnInit, OnDestroy {
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
  private wsSubscriptions: Subscription[] = [];

  // Variable para manejar el mensaje de error
  errorMessage: string | null = null;

  constructor(
    private webSocketService: WebsocketService,
    private apiService: ApiService,
    private authService: AuthService,
    private router: Router,
    private imageService: ImageService,
    private friendService: FriendService,
    private cdr: ChangeDetectorRef
  ) {
    this.perfil_default = this.imageService.getImageUrl('Perfil_Deffault.png');
  }

  ngOnInit(): void {
    console.log('MenuComponent: ngOnInit() llamado');

    // 1. Conexión inicial WebSocket
    const token = localStorage.getItem('accessToken');
    if (token) {
      console.log('Token:', token);
      this.cargarInfoUsuario();
      this.webSocketService.connectRxjs(token);
    } else {
      console.error('No hay token disponible. Redirigiendo al login...');
      this.router.navigate(['/login']);
    }

    // 2. Carga de datos (sin duplicados)
    this.obtenerUsuarios();
    this.cargarAmigos();
    this.obtenerSolicitudesPendientes();

    // 3. Configurar listeners WebSocket
    this.setupWebSocketListeners();
  }

  private setupWebSocketListeners(): void {
    // Listener para mensajes generales
    this.wsSubscriptions.push(
      this.webSocketService.messageReceived.subscribe((message: any) => {
        console.log("Mensaje recibido de WebSocket:", message);
        if (message.type === 'invalidInvitation') {
          this.handleInvalidInvitation(message);
        }
        if (message.type === 'friendNotAvailable') {
          this.errorMessage = message.message; // Mostrar mensaje de error
          setTimeout(() => this.errorMessage = null, 5000); // Ocultar después de 5 segundos
        }
        if (message.FriendId) {
          console.log(`Actualizando estado del amigo ${message.FriendId} a ${message.Estado}`);
          this.actualizarEstadoAmigo(message.FriendId, message.Estado);
        }
        if (message.type === 'invitationReceived') {
          this.handleInvitation(message);
        }
      })
    );

    // Listeners de conexión/desconexión
    this.wsSubscriptions.push(
      this.webSocketService.connected.subscribe(() => {
        console.log('WebSocket conectado');
      }),
      this.webSocketService.disconnected.subscribe(() => {
        console.log('WebSocket desconectado');
      }),
      this.webSocketService.activeConnections.subscribe((count) => {
        this.activeConnections = count;
        console.log(`Conexiones activas: ${count}`);
      }),
      this.webSocketService.messageReceived.subscribe((message: any) => {
        console.log("Mensaje WebSocket recibido:", message);
        if (message.type === 'friendConnected' || message.type === 'friendDisconnected') {
          const estado = message.type === 'friendConnected' ? 'Conectado' : 'Desconectado';
          this.actualizarEstadoAmigo(message.friendId, estado);
        }
        if (message.type === 'activeConnections') {
          this.activeConnections = message.count;
        }
      })
    );
  }

  ngOnDestroy(): void {
    // Limpieza de subscriptions
    this.wsSubscriptions.forEach(sub => sub.unsubscribe());
  }

  private handleInvitation(message: any): void {
    const aceptar = confirm(`${message.inviterName} te ha invitado a una partida. ¿Aceptas?`);
    if (aceptar) {
      this.webSocketService.sendRxjs(JSON.stringify({
        type: 'acceptInvitation',
        inviterId: message.inviterId
      }));
    }
  }

  private handleInvalidInvitation(message: any): void {
    alert(`Error de invitación: ${message.message}`);
    console.error('Intento de auto-invitación bloqueado');
  }

  actualizarEstadoAmigo(friendId: number, estado: string): void {
    this.amigos = this.amigos.map(amigo => {
      if (amigo.UsuarioId === friendId) {
        return { ...amigo, UsuarioEstado: estado };
      }
      return amigo;
    });
    // Forzar actualización de la vista
    this.cdr.detectChanges();
  }

  invitarAPartida(friendId: number): void {
    if (!friendId || friendId === this.usuarioId) {
      alert('Selecciona un amigo válido');
      return;
    }

    // Verificar conexión WebSocket
    if (!this.webSocketService.isConnectedRxjs()) {
      const token = this.authService.getUserDataFromToken();
      if (token) this.webSocketService.connectRxjs(token);
    }

    // Enviar mensaje
    this.webSocketService.sendRxjs(JSON.stringify({
      type: 'inviteFriend',
      friendId: friendId
    }));
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

  logout() {
    this.authService.logout();
    this.webSocketService.clearToken();
    this.webSocketService.disconnectRxjs();
    sessionStorage.removeItem('auth_token');
    this.router.navigate(['/login']);
  }

  cargarInfoUsuario(): void {
    const userInfo = this.authService.getUserDataFromToken();
    if (userInfo) {
      this.usuarioApodo = userInfo.name;
      this.usuarioFotoPerfil = this.validarUrlImagen(userInfo.profilePicture);
      this.usuarioId = userInfo.id;
    } else {
      console.error('No se pudo obtener la información del usuario. ¿El token está disponible?');
      this.router.navigate(['/login']); // Redirigir al login si no hay token
    }
  }

  enviarSolicitud(receiverId: number): void {
    this.friendService.sendFriendRequest(receiverId).subscribe({
      next: (result) => {
        console.log(`Solicitud de amistad enviada a ${receiverId}`);
        console.log(`El usuario que envió la solicitud es: ${result.senderName}`);
        this.obtenerSolicitudesPendientes();
      },
      error: (error) => {
        console.error('Error al enviar la solicitud:', error);
      }
    });
  }

  obtenerSolicitudesPendientes() {
    this.friendService.getPendingRequests().subscribe({
      next: (solicitudes: any[]) => {
        console.log('Solicitudes pendientes recibidas:', solicitudes);
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
    return usuario ? usuario.UsuarioApodo : 'te ha equivocao compi 😂';
  }

  aceptarSolicitud(solicitud: any) {
    console.log('Solicitud recibida:', solicitud);

    if (!solicitud) {
      console.error('Error: La solicitud es null o undefined');
      return;
    }

    if (!solicitud.amistadId) {
      console.error('Error: amistadId no está definido en la solicitud:', solicitud);
      return;
    }

    const amistadId = solicitud.amistadId;
    console.log('Enviando amistadId:', amistadId);

    this.friendService.aceptarSolicitud(amistadId).subscribe({
      next: (res) => console.log('Solicitud aceptada:', res),
      error: (err) => console.error('Error al aceptar solicitud:', err),
    });
  }

  rechazarSolicitud(solicitud: any) {
    console.log('Solicitud recibida para rechazar:', solicitud);

    if (!solicitud) {
      console.error('Error: La solicitud es null o undefined');
      return;
    }

    if (!solicitud.amistadId) {
      console.error('Error: amistadId no está definido en la solicitud:', solicitud);
      return;
    }

    const amistadId = solicitud.amistadId;
    console.log('Enviando rechazo para amistadId:', amistadId);

    this.friendService.rechazarSolicitud(amistadId).subscribe({
      next: (res) => console.log('Solicitud rechazada:', res),
      error: (err) => console.error('Error al rechazar solicitud:', err)
    });
  }

  cargarAmigos(): void {
    this.friendService.getFriendsList().subscribe(amigos => {
      this.amigos = amigos.map(amigo => ({
        UsuarioId: amigo.UsuarioId || amigo.usuarioId,
        UsuarioApodo: amigo.UsuarioApodo || amigo.usuarioApodo,
        UsuarioFotoPerfil: this.validarUrlImagen(amigo.UsuarioFotoPerfil || amigo.usuarioFotoPerfil),
        UsuarioEstado: amigo.UsuarioEstado || amigo.usuarioEstado || 'Desconectado'
      }));
      this.amigosFiltrados = [...this.amigos];
      this.webSocketService.sendRxjs(JSON.stringify({
        type: 'requestStatusUpdate'
      }));
    });
  }

  actualizarEstadoDeAmigos() {
    this.friendService.getFriendsList().subscribe(amigos => {
      this.amigos = amigos.map(amigo => ({
        UsuarioId: amigo.UsuarioId || amigo.usuarioId,
        UsuarioApodo: amigo.UsuarioApodo || amigo.usuarioApodo,
        UsuarioFotoPerfil: this.validarUrlImagen(amigo.UsuarioFotoPerfil || amigo.usuarioFotoPerfil),
        UsuarioEstado: this.obtenerEstadoAmigo(amigo.UsuarioId || amigo.usuarioId)
      }));
      this.amigosFiltrados = [...this.amigos];
    });
  }

  private obtenerEstadoAmigo(usuarioId: string): string {
    return this.usuariosConectados.has(usuarioId) ? 'Conectado' : 'Desconectado';
  }
}
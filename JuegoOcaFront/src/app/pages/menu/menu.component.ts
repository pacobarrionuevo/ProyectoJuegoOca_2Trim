import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { WebsocketService } from '../../services/websocket.service';
import { User } from '../../models/User';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { ImageService } from '../../services/image.service';
import { SolicitudAmistad } from '../../models/solicitud-amistad';
import { FriendService } from '../../services/friend.service';
import { Subscription } from 'rxjs';
import { environment } from '../../../environments/environment';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-menu',
  standalone: true,
  imports:[FormsModule,RouterModule,CommonModule],
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.css']
})
export class MenuComponent implements OnInit, OnDestroy {
  // Lista de usuarios y amigos
  usuarios: User[] = [];
  usuariosFiltrados: User[] = [];
  amigos: User[] = [];
  amigosFiltrados: User[] = [];
private BASE_URL = environment.apiUrl;
  // Estado de conexión
  onlineUserIds = new Set<number>(); // Almacena IDs de usuarios conectados
  private subs: Subscription[] = []; // Para manejar subscripciones

  // Búsqueda y filtrado
  terminoBusqueda: string = '';
  busquedaAmigos: string = '';

  // Información del usuario actual
  usuarioApodo: string = '';
  usuarioFotoPerfil: string = '';
  usuarioId: number | null = null;
  perfil_default: string;

  // Solicitudes de amistad
  solicitudesPendientes: SolicitudAmistad[] = [];

  // Mensajes de error
  errorMessage: string | null = null;

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
    this.cargarInfoUsuario();
    this.obtenerUsuarios();
    this.cargarAmigos();
    this.obtenerSolicitudesPendientes();

    // Conectar al WebSocket
    const token = localStorage.getItem('accessToken');
    if (token) {
      this.webSocketService.connectRxjs(token);
    }

    // Configurar listeners del WebSocket
    this.setupWebSocketListeners();

    // Cargar usuarios conectados
    this.loadOnlineUsers();
  }

  ngOnDestroy(): void {
    // Limpiar subscripciones
    this.subs.forEach(sub => sub.unsubscribe());
  }

  // Cargar usuarios conectados
  private loadOnlineUsers(): void {
    this.subs.push(
      this.webSocketService.fetchOnlineUsers().subscribe({
        next: (users) => {
          this.onlineUserIds = new Set(users);
        },
        error: (err) => {
          console.error('Error cargando usuarios conectados:', err);
          this.errorMessage = 'No se pudo cargar la lista de usuarios conectados';
        }
      })
    );
  }

  // Configurar listeners del WebSocket
  private setupWebSocketListeners(): void {
    this.subs.push(
      this.webSocketService.onlineUsers$.subscribe(users => {
        this.onlineUserIds = users;
      }),

      this.webSocketService.messageReceived.subscribe((message: any) => {
        if (message.type === 'friendConnected') {
          this.onlineUserIds.add(message.friendId);
        } else if (message.type === 'friendDisconnected') {
          this.onlineUserIds.delete(message.friendId);
        }
      })
    );
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

  // Verificar si un usuario está conectado
  isUserOnline(userId: number): boolean {
    return this.onlineUserIds.has(userId);
  }

  // Cargar información del usuario actual
  private cargarInfoUsuario(): void {
    const userInfo = this.authService.getUserDataFromToken();
    if (userInfo) {
      this.usuarioApodo = userInfo.name;
      this.usuarioFotoPerfil = this.validarUrlImagen(userInfo.profilePicture);
      this.usuarioId = userInfo.id;
    } else {
      this.router.navigate(['/login']);
    }
  }

  // Obtener lista de usuarios
  private obtenerUsuarios(): void {
    this.apiService.getUsuarios().subscribe(usuarios => {
      this.usuarios = usuarios.map(usuario => ({
        UsuarioId: usuario.usuarioId,
        UsuarioApodo: usuario.usuarioApodo,
        UsuarioFotoPerfil: this.validarUrlImagen(usuario.usuarioFotoPerfil)
      }));
      this.usuariosFiltrados = [...this.usuarios];
    });
  }

  // Buscar usuarios
  buscarUsuarios(): void {
    this.usuariosFiltrados = this.terminoBusqueda.trim()
      ? this.usuarios.filter(usuario =>
          usuario.UsuarioApodo?.toLowerCase().includes(this.terminoBusqueda.toLowerCase()))
      : [...this.usuarios];
  }

  // Cargar lista de amigos
  private cargarAmigos(): void {
    this.friendService.getFriendsList().subscribe(amigos => {
      this.amigos = amigos.map(amigo => ({
        UsuarioId: amigo.UsuarioId || amigo.usuarioId,
        UsuarioApodo: amigo.UsuarioApodo || amigo.usuarioApodo,
        UsuarioFotoPerfil: this.validarUrlImagen(amigo.UsuarioFotoPerfil || amigo.usuarioFotoPerfil),
        UsuarioEstado: this.isUserOnline(amigo.UsuarioId || amigo.usuarioId) ? 'Conectado' : 'Desconectado'
      }));
      this.amigosFiltrados = [...this.amigos];
    });
  }

  // Validar URL de imagen
  validarUrlImagen(fotoPerfil: string | null): string {
    return fotoPerfil ? `${this.BASE_URL}/fotos/${fotoPerfil}` : this.perfil_default;
  }

  // Enviar solicitud de amistad
  enviarSolicitud(receiverId: number): void {
    this.friendService.sendFriendRequest(receiverId).subscribe({
      next: (result) => {
        console.log('Solicitud enviada:', result);
        this.obtenerSolicitudesPendientes();
      },
      error: (error) => {
        console.error('Error enviando solicitud:', error);
        this.errorMessage = 'No se pudo enviar la solicitud';
      }
    });
  }

  // Obtener solicitudes pendientes
  private obtenerSolicitudesPendientes(): void {
    this.friendService.getPendingRequests().subscribe({
      next: (solicitudes) => {
        this.solicitudesPendientes = solicitudes.map(solicitud => ({
          amistadId: solicitud.amistadId,
          usuarioId: solicitud.usuarioId,
          usuarioApodo: solicitud.usuarioApodo,
          usuarioFotoPerfil: this.validarUrlImagen(solicitud.usuarioFotoPerfil)
        }));
      },
      error: (error) => {
        console.error('Error obteniendo solicitudes:', error);
        this.errorMessage = 'No se pudieron cargar las solicitudes';
      }
    });
  }

  // Aceptar solicitud de amistad
  aceptarSolicitud(solicitud: SolicitudAmistad): void {
    this.friendService.aceptarSolicitud(solicitud.amistadId).subscribe({
      next: () => {
        this.obtenerSolicitudesPendientes();
        this.cargarAmigos();
      },
      error: (error) => {
        console.error('Error aceptando solicitud:', error);
        this.errorMessage = 'No se pudo aceptar la solicitud';
      }
    });
  }

  // Rechazar solicitud de amistad
  rechazarSolicitud(solicitud: SolicitudAmistad): void {
    this.friendService.rechazarSolicitud(solicitud.amistadId).subscribe({
      next: () => {
        this.obtenerSolicitudesPendientes();
      },
      error: (error) => {
        console.error('Error rechazando solicitud:', error);
        this.errorMessage = 'No se pudo rechazar la solicitud';
      }
    });
  }

  // Cerrar sesión
  logout(): void {
    this.authService.logout();
    this.webSocketService.clearToken();
    this.webSocketService.disconnectRxjs();
    this.router.navigate(['/login']);
  }
}
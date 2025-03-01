import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { WebsocketService } from '../../services/websocket.service';
import { User } from '../../models/User';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { ImageService } from '../../services/image.service';
import { SolicitudAmistad } from '../../models/solicitud-amistad';
import { FriendService } from '../../services/friend.service';
import { Subscription, interval } from 'rxjs';
import { environment } from '../../../environments/environment';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [FormsModule, RouterModule, CommonModule],
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.css']
})
export class MenuComponent implements OnInit, OnDestroy {
  usuarios: User[] = [];
  usuariosFiltrados: User[] = [];
  amigos: User[] = [];
  amigosFiltrados: User[] = [];
  private BASE_URL = environment.apiUrl;
  onlineUserIds = new Set<number>();
  private subs: Subscription[] = [];
  terminoBusqueda: string = '';
  busquedaAmigos: string = '';
  usuarioApodo: string = '';
  usuarioFotoPerfil: string = '';
  usuarioId: number | null = null;
  perfil_default: string;
  solicitudesPendientes: SolicitudAmistad[] = [];
  errorMessage: string | null = null;
  opponentId: number | null = null;
  gameId: string | null = null;

  constructor(
    public webSocketService: WebsocketService,
    private apiService: ApiService,
    private authService: AuthService,
    private router: Router,
    private imageService: ImageService,
    private friendService: FriendService,
    private ngZone: NgZone
  ) {
    this.perfil_default = this.imageService.getImageUrl('Perfil_Deffault.png');
  }

  ngOnInit(): void {
    this.cargarInfoUsuario();
    this.obtenerUsuarios();
    this.cargarAmigos();
    this.obtenerSolicitudesPendientes();
    this.inicializarWebSockets();
    this.inicializarActualizaciones();
  }

  ngOnDestroy(): void {
    this.subs.forEach(sub => sub.unsubscribe());
  }

  private inicializarWebSockets(): void {
    const token = localStorage.getItem('accessToken');
    if (token) this.webSocketService.connectRxjs(token);

    this.subs.push(
      this.webSocketService.messageReceived.subscribe(message => {
        this.ngZone.run(() => this.procesarMensajesWebSocket(message));
      }),
      
      this.webSocketService.onlineUsers$.subscribe(users => {
        this.ngZone.run(() => {
          this.onlineUserIds = new Set(users);
          this.actualizarEstadosAmigos();
        });
      })
    );
  }
  
  private inicializarActualizaciones(): void {
    this.subs.push(
      interval(1000).subscribe(() => this.actualizarUsuariosConectados()),
      interval(30000).subscribe(() => this.actualizarListasCompletas())
    );
  }

  private procesarMensajesWebSocket(message: any): void {
    switch(message.type) {
      case 'gameReady':
        this.manejarGameReady(message);
        break;
      case 'friendRequest':
        this.manejarSolicitudAmistad(message);
        break;
      case 'friendRequestAccepted':
        this.manejarSolicitudAceptada(message);
        break;
      case 'friendRequestRejected':
        this.manejarSolicitudRechazada(message);
        break;
      case 'friendListUpdate':
        this.actualizarListasCompletas();
        break;
    }
  }

  private actualizarListasCompletas(): void {
    this.cargarAmigos();
    this.obtenerSolicitudesPendientes();
  }

  private actualizarEstadosAmigos(): void {
    this.amigos = this.amigos.map(amigo => ({
      ...amigo,
      UsuarioEstado: this.onlineUserIds.has(amigo.UsuarioId) ? 'Conectado' : 'Desconectado'
    }));
    this.amigosFiltrados = [...this.amigos];
  }

  private actualizarUsuariosConectados(): void {
    this.webSocketService.fetchOnlineUsers().subscribe({
      next: (users) => this.onlineUserIds = new Set(users),
      error: (err) => console.error('Error actualizando usuarios:', err)
    });
  }

  private manejarGameReady(message: any): void {
    this.router.navigate(['/game'], {
      state: {
        gameId: message.gameId,
        opponentId: message.opponentId 
      }
    });
  }

  private manejarSolicitudAmistad(message: any): void {
    const nuevaSolicitud: SolicitudAmistad = {
      amistadId: message.requestId,
      usuarioId: message.senderId,
      usuarioApodo: message.senderName,
      usuarioFotoPerfil: this.validarUrlImagen(null)
    };
    this.solicitudesPendientes = [...this.solicitudesPendientes, nuevaSolicitud];
  }

  private manejarSolicitudAceptada(message: any): void {
    this.actualizarListasCompletas();
    this.errorMessage = `¡Ahora eres amigo de ${message.friendName}!`;
    setTimeout(() => this.errorMessage = null, 5000);
  }

  private manejarSolicitudRechazada(message: any): void {
    this.solicitudesPendientes = this.solicitudesPendientes.filter(
      s => s.amistadId !== message.requestId
    );
    this.errorMessage = message.reason || 'Solicitud rechazada';
    setTimeout(() => this.errorMessage = null, 5000);
  }

  // Métodos de interacción del usuario
  enviarSolicitud(receiverId: number): void {
    this.webSocketService.sendRxjs(JSON.stringify({
      type: 'sendFriendRequest',
      receiverId: receiverId
    }));
  }

  aceptarSolicitud(solicitud: SolicitudAmistad): void {
    this.webSocketService.sendRxjs(JSON.stringify({
      type: 'acceptFriendRequest',
      requestId: solicitud.amistadId
    }));
  }

  rechazarSolicitud(solicitud: SolicitudAmistad): void {
    this.webSocketService.sendRxjs(JSON.stringify({
      type: 'rejectFriendRequest',
      requestId: solicitud.amistadId
    }));
  }

  invitarAPartida(friendId: number): void {
    if (!friendId || friendId === this.usuarioId) return;
    
    if (!this.webSocketService.isConnectedRxjs()) {
      const token = this.authService.getUserDataFromToken();
      if (token) this.webSocketService.connectRxjs(token);
    }
    
    this.webSocketService.sendRxjs(JSON.stringify({
      type: 'inviteFriend',
      friendId: friendId
    }));
  }

  // Métodos auxiliares
  private cargarInfoUsuario(): void {
    const userInfo = this.authService.getUserData();
    if (userInfo) {
      this.usuarioApodo = userInfo.apodo;
      this.usuarioFotoPerfil = this.validarUrlImagen(userInfo.fotoPerfil);
      this.usuarioId = userInfo.id;
    } else {
      this.router.navigate(['/login']);
    }
  }

  private obtenerUsuarios(): void {
    this.apiService.getUsuarios().subscribe({
      next: (usuarios) => {
        this.usuarios = usuarios.map(usuario => this.mapearUsuario(usuario));
        this.usuariosFiltrados = [...this.usuarios];
      },
      error: (err) => console.error('Error cargando usuarios:', err)
    });
  }

  private cargarAmigos(): void {
    this.friendService.getFriendsList().subscribe({
      next: (amigos) => {
        this.amigos = amigos.map(amigo => this.mapearAmigo(amigo));
        this.actualizarEstadosAmigos();
      },
      error: (err) => console.error('Error cargando amigos:', err)
    });
  }

  private obtenerSolicitudesPendientes(): void {
    this.friendService.getPendingRequests().subscribe({
      next: (solicitudes) => {
        this.solicitudesPendientes = solicitudes.map(solicitud => 
          this.mapearSolicitud(solicitud)
        );
      },
      error: (err) => console.error('Error cargando solicitudes:', err)
    });
  }

  private mapearUsuario(usuario: any): User {
    return {
      UsuarioId: usuario.usuarioId,
      UsuarioApodo: usuario.usuarioApodo,
      UsuarioFotoPerfil: this.validarUrlImagen(usuario.usuarioFotoPerfil)
    };
  }

  private mapearAmigo(amigo: any): User {
    return {
      UsuarioId: amigo.UsuarioId || amigo.usuarioId,
      UsuarioApodo: amigo.UsuarioApodo || amigo.usuarioApodo,
      UsuarioFotoPerfil: this.validarUrlImagen(amigo.UsuarioFotoPerfil || amigo.usuarioFotoPerfil),
      UsuarioEstado: 'Desconectado'
    };
  }

  private mapearSolicitud(solicitud: any): SolicitudAmistad {
    return {
      amistadId: solicitud.amistadId,
      usuarioId: solicitud.usuarioId,
      usuarioApodo: solicitud.usuarioApodo,
      usuarioFotoPerfil: this.validarUrlImagen(solicitud.usuarioFotoPerfil)
    };
  }

  validarUrlImagen(fotoPerfil: string | null): string {
    return fotoPerfil ? `${this.BASE_URL}/fotos/${fotoPerfil}` : this.perfil_default;
  }

  buscarUsuarios(): void {
    this.usuariosFiltrados = this.terminoBusqueda.trim()
      ? this.usuarios.filter(usuario =>
          usuario.UsuarioApodo?.toLowerCase().includes(this.terminoBusqueda.toLowerCase()))
      : [...this.usuarios];
  }

  isUserOnline(userId: number): boolean {
    return this.onlineUserIds.has(userId);
  }

  logout(): void {
    this.authService.logout();
    this.webSocketService.clearToken();
    this.webSocketService.disconnectRxjs();
    this.router.navigate(['/login']);
  }
}
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
    const state = history.state;
  this.gameId = state.gameId;
  this.opponentId = state.opponentId;
  this.subs.push(
    this.webSocketService.messageReceived.subscribe(message => {
      switch(message.type) {
        case 'friendRequest':
          this.handleFriendRequest(message);
          break;
          
        case 'friendRequestAccepted':
          this.handleFriendRequestAccepted(message);
          break;
          
        case 'friendRequestRejected':
          this.handleFriendRequestRejected(message);
          break;
      }
    })
  );
    this.subs.push(
      this.webSocketService.messageReceived.subscribe(message => {
        if (message.type === 'gameReady') {
          console.log('Redirigiendo a game component con gameId:', message.gameId);
          
          this.router.navigate(['/game'], {
            state: {
              gameId: this.gameId,
              opponentId: this.opponentId 
            }
          });
          
        }
      })),
    this.subs.push(
      this.webSocketService.onlineUsers$.subscribe(users => {
        console.log('Usuarios en línea actualizados:', users);
        this.onlineUserIds = users;
      })
    )
    ;

    const token = localStorage.getItem('accessToken');
    if (token) {
      this.webSocketService.connectRxjs(token);
    }
    this.setupWebSocketListeners();
    this.loadOnlineUsers();

 //refrescar la lista de usuarios conectados cada segundo
    const intervalSub = interval(1000).subscribe(() => {
      this.loadOnlineUsers();
    });
    this.subs.push(intervalSub);
  }

  ngOnDestroy(): void {
    this.subs.forEach(sub => sub.unsubscribe());
  }

  private loadOnlineUsers(): void {
    this.subs.push(
      this.webSocketService.fetchOnlineUsers().subscribe({
        next: (users) => {
          // Se crea un nuevo Set para forzar la detección de cambios
          this.onlineUserIds = new Set(users);
        },
        error: (err) => {
          this.onlineUserIds = new Set();
          console.error('Error cargando usuarios:', err);
        }
      })
    );
  }

  private setupWebSocketListeners(): void {
    this.subs.push(
      this.webSocketService.onlineUsers$.subscribe(users => {
        this.onlineUserIds = users;
      })
    );
  }
  private handleFriendRequest(message: any): void {
    const nuevaSolicitud: SolicitudAmistad = {
      amistadId: message.requestId,
      usuarioId: message.senderId,
      usuarioApodo: message.senderName,
      usuarioFotoPerfil: this.perfil_default
    };
    
    this.solicitudesPendientes.push(nuevaSolicitud);
  }
  
  private handleFriendRequestAccepted(message: any): void {
    const nuevoAmigo: User = {
      UsuarioId: message.friendId,
      UsuarioApodo: message.friendName,
      UsuarioFotoPerfil: this.perfil_default
    };
    
    this.amigos.push(nuevoAmigo);
    this.amigosFiltrados = [...this.amigos];
  }
  private handleFriendRequestRejected(message: any): void {
    // 1. Eliminar la solicitud rechazada de la lista local
    this.solicitudesPendientes = this.solicitudesPendientes.filter(
      solicitud => solicitud.amistadId !== message.requestId
    );
  
    // 2. Actualizar lista de amigos por si acaso
    this.cargarAmigos();
  
    // 3. Mostrar notificación al usuario
    this.errorMessage = `La solicitud de amistad fue rechazada.`;
    setTimeout(() => this.errorMessage = null, 5000);
  
  }
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
    if (!friendId || friendId === this.usuarioId) {
      alert('Selecciona un amigo válido');
      return;
    }
    if (!this.webSocketService.isConnectedRxjs()) {
      const token = this.authService.getUserDataFromToken();
      if (token) this.webSocketService.connectRxjs(token);
    }
    this.webSocketService.sendRxjs(JSON.stringify({
      type: 'inviteFriend',
      friendId: friendId
    }));
  }

  isUserOnline(userId: number): boolean {
    return this.onlineUserIds.has(userId);
  }

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

  buscarUsuarios(): void {
    this.usuariosFiltrados = this.terminoBusqueda.trim()
      ? this.usuarios.filter(usuario =>
          usuario.UsuarioApodo?.toLowerCase().includes(this.terminoBusqueda.toLowerCase()))
      : [...this.usuarios];
  }

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

  validarUrlImagen(fotoPerfil: string | null): string {
    return fotoPerfil ? `${this.BASE_URL}/fotos/${fotoPerfil}` : this.perfil_default;
  }

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


  logout(): void {
    this.authService.logout();
    this.webSocketService.clearToken();
    this.webSocketService.disconnectRxjs();
    this.router.navigate(['/login']);
  }
}

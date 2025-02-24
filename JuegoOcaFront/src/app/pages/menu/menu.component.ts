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
  getFotoPerfilUrl(arg0: string) {
throw new Error('Method not implemented.');
}

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
    this.cargarAmigos();
    this.obtenerSolicitudesPendientes();

    // no se está llamando porque no se están recibiendo estos mensajes desde el websocket.service.ts
    this.webSocketService.messageReceived.subscribe((message: any) => {
      console.log("Mensaje recibido de WebSocket:", message);
      if (message.FriendId) {
        console.log(`MenuComponent: Actualizando estado del amigo ${message.FriendId} a ${message.Estado}`);
        this.actualizarEstadoAmigo(message.FriendId, message.Estado);
      }
    });

    // Suscribirse a los eventos de conexión/desconexión
    this.webSocketService.connected.subscribe(() => {
      console.log('WebSocket conectado');
    });

    this.webSocketService.disconnected.subscribe(() => {
      console.log('WebSocket desconectado');
    });
  }

  // No se está haciendo, pero se tiene que actualizar individualmente la lógica de cada amigo de la lista,
  // porque no es dependiente de los demás
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

  // ==================================================
  // =============== MÉTODO DE SALGUERO ===============
  // ==================================================
  invitarAPartida(friendId: number) {
    if (!friendId) {
      console.error('ID de amigo no válido.');
      return;
    }

    // Salguero comenta esto bien cabron

    // Verificar si el WebSocket está conectado
    if (!this.webSocketService.isConnectedRxjs()) {
      console.warn('WebSocket no está conectado. Reconectando...');
      const token = this.authService.getUserDataFromToken(); // Obtener el token del usuario
      if (token) {
        this.webSocketService.connectRxjs(token); // Reconectar el WebSocket
      } else {
        console.error('No se pudo obtener el token del usuario.');
        return;
      }
    }

    // Enviar la invitación a través del WebSocket
    const message = {
      type: 'inviteFriend',
      friendId: friendId
    };
    this.webSocketService.sendRxjs(JSON.stringify(message));

    console.log(`Invitación enviada al amigo con ID: ${friendId}`);
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
          usuario.UsuarioApodo?.toLowerCase().includes(this.terminoBusqueda.toLowerCase())
        ) 
      : [...this.usuarios];
  }

  // La sesión se cierra bien
  // Hacer que se cierren los websockets también
  logout() {
    this.authService.logout();
    this.webSocketService.clearToken();
    this.webSocketService.disconnectRxjs();
    sessionStorage.removeItem('auth_token');
    this.router.navigate(['/login']); 
  }

  // La info se carga bien sin problema a no ser que tengas una foto por defecto
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

  // La solicitud se manda bien y sin problemas
  // --> Hacer mediante websockets D:
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
  
  // Las carga correctamente --> ¿Websockets?
  obtenerSolicitudesPendientes() {
    this.friendService.getPendingRequests().subscribe({
      next: (solicitudes: any[]) => {
        console.log('Solicitudes pendientes recibidas:', solicitudes);
        // Mapeamos cada objeto de amistad a nuestra interfaz SolicitudAmistad.
        // Se asume que this.usuarioId es el ID del usuario autenticado, de modo que se
        // busca en cada amistad el usuario contrario (por ejemplo, el que envió la solicitud)
        this.solicitudesPendientes = solicitudes.map(amistadObj => {
          // Buscar en el array amistadUsuario el que NO sea el usuario actual.
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
    return usuario ? usuario.UsuarioApodo : 'te ha equivocao compi 😂';
  }
  
  // Se acepta todo guay
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
  
  // Se rechaza todo guay
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
  
  // Cargan bien
  cargarAmigos(): void {
    this.friendService.getFriendsList().subscribe(amigos => {
      this.amigos = amigos.map(amigo => ({
        UsuarioId: amigo.UsuarioId || amigo.usuarioId,
        UsuarioApodo: amigo.UsuarioApodo || amigo.usuarioApodo,
        UsuarioFotoPerfil: this.validarUrlImagen(amigo.UsuarioFotoPerfil || amigo.usuarioFotoPerfil),
        UsuarioEstado: amigo.UsuarioEstado || amigo.usuarioEstado
      }));
      this.amigosFiltrados = [...this.amigos];
    });
  }
  
  /// No entiendo para qué sirve esto
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

  // Bueno, esto se puede quedar
  private obtenerEstadoAmigo(usuarioId: string): string {
    return this.usuariosConectados.has(usuarioId) ? 'Conectado' : 'Desconectado';
  }  
}
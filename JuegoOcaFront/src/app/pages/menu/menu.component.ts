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
    this.obtenerUsuarios();
    this.cargarInfoUsuario(); 
    this.cargarAmigos();
    this.obtenerSolicitudesPendientes();

    this.webSocketService.connected.subscribe(() => {
        console.log('🎉 Evento recibido: WebSocket conectado en el menú.');
        this.cargarAmigos();
    });

    this.webSocketService.disconnected.subscribe(() => {
        console.log('😢 Evento recibido: WebSocket desconectado en el menú.');
        this.marcarTodosDesconectados();
    });

    this.webSocketService.messageReceived.subscribe((message: any) => {
        console.log("📩 WebSocket - Mensaje recibido:", message);
        if (message.Type === 'friendConnected' || message.Type === 'friendDisconnected') {
            console.log(`🔄 Amigo ${message.FriendId} ha cambiado de estado a ${message.Type}`);
            this.actualizarEstadoAmigo(message.FriendId, message.Type === 'friendConnected' ? 'Conectado' : 'Desconectado');
        }
    });
}


  actualizarEstadoAmigo(friendId: number, estado: string) {
    const amigo = this.amigos.find(a => a.UsuarioId === friendId);
    if (amigo) {
        console.log(`🟢 Actualizando estado de amigo ${friendId} a ${estado}`);
        amigo.UsuarioEstado = estado;
    } else {
        console.warn(`⚠️ No se encontró el amigo con ID ${friendId}`);
    }
  }


  invitarAPartida(friendId: number) {
    if (!friendId) {
      console.error('ID de amigo no válido.');
      return;
    }

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

  buscarAmigos(): void {
    this.amigosFiltrados = this.busquedaAmigos.trim()
      ? this.amigos.filter(amigo => amigo.UsuarioApodo?.toLowerCase().includes(this.busquedaAmigos.toLowerCase()))
      : [...this.amigos];
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
          usuario.UsuarioApodo?.toLowerCase().includes(this.terminoBusqueda.toLowerCase())
        ) 
      : [...this.usuarios];
  }

  logout() {
    this.webSocketService.closeConnection();  // Cierra WebSocket
    console.log("WEBSOCKET CERRADO AL CERRAR SESIÓN")
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
      console.log("Lista de amigos recibida:", amigos);
      this.amigos = amigos.map(amigo => ({
        UsuarioId: amigo.UsuarioId || amigo.usuarioId,
        UsuarioApodo: amigo.UsuarioApodo || amigo.usuarioApodo,
        UsuarioFotoPerfil: this.validarUrlImagen(amigo.UsuarioFotoPerfil || amigo.usuarioFotoPerfil),
        UsuarioEstado: amigo.UsuarioEstado || amigo.usuarioEstado
      }));
      console.log("Amigos después de mapear:", this.amigos);
      this.amigosFiltrados = [...this.amigos];
    });    
  }
  
  // Comentar
  actualizarEstadoDeAmigos() {
    this.friendService.getFriendsList().subscribe(amigos => {
      this.amigos = amigos.map(amigo => ({
        UsuarioId: amigo.UsuarioId || amigo.usuarioId,
        UsuarioApodo: amigo.UsuarioApodo || amigo.usuarioApodo,
        UsuarioFotoPerfil: this.validarUrlImagen(amigo.UsuarioFotoPerfil || amigo.usuarioFotoPerfil),
        UsuarioEstado: this.obtenerEstadoAmigo(amigo.UsuarioId || amigo.usuarioId) // Obtener estado real
      }));
  
      this.amigosFiltrados = [...this.amigos];
    });
  }

  private obtenerEstadoAmigo(usuarioId: string): string {
    return this.usuariosConectados.has(usuarioId) ? 'Conectado' : 'Desconectado';
  }

  marcarTodosDesconectados() {
    console.log('🔴 Marcando todos los amigos como desconectados.');
    console.log('📋 Usuarios conectados antes:', this.usuariosConectados);
    this.usuariosConectados.clear();
    this.amigos.forEach(amigo => amigo.UsuarioEstado = 'Desconectado');
    console.log('📋 Usuarios conectados después:', this.usuariosConectados);
  }
}
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
export class MenuComponent implements OnInit, OnDestroy {

  message: string = '';
  serverResponse: string = '';
  isConnected: boolean = false;
  connected$: Subscription;
  messageReceived$: Subscription;
  disconnected$: Subscription;
  type: 'rxjs';

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
    this.connected$ = this.webSocketService.connected.subscribe(() => this.isConnected = true);
    this.messageReceived$ = this.webSocketService.messageReceived.subscribe(message => this.serverResponse = message);
    this.disconnected$ = this.webSocketService.disconnected.subscribe(() => this.isConnected = false);
  }

  getFotoPerfilUrl(fotoPerfil: string): string {
    return `${environment.apiUrl}/fotos/${fotoPerfil}`;
  }

  connectRxjs() {
    this.webSocketService.connectRxjs();
  }

  send() {
    this.webSocketService.sendRxjs(this.message);
  }

  disconnect() {
    this.webSocketService.disconnectRxjs();
  }

  ngOnDestroy(): void {
    this.connected$.unsubscribe();
    this.messageReceived$.unsubscribe();
    this.disconnected$.unsubscribe();
  }
 
  activeSection: string = 'amigos';

  obtenerUsuarios(): void {
    this.apiService.getUsuarios().subscribe(usuarios => {
      console.log('Usuarios obtenidos:', usuarios); 
      this.usuarios = usuarios;
      this.usuariosFiltrados = this.usuarios; 
      console.log('Usuarios filtrados:', this.usuariosFiltrados);
    });
  }

  buscarUsuarios(): void {
    if (this.terminoBusqueda) {
      this.usuariosFiltrados = this.usuarios.filter(usuario => {
        const apodo = usuario.UsuarioApodo || '';
        return apodo.toLowerCase().includes(this.terminoBusqueda.toLowerCase());
      });
    } else {
      this.usuariosFiltrados = this.usuarios;
    }
    console.log('Usuarios filtrados después de buscar:', this.usuariosFiltrados);
  }

  cambiarVista(vista: string): void {
    this.vistaActiva = vista;
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
  }

  cargarAmigos(): void {
    if (this.usuarioId) {
      this.apiService.getFriendsList(this.usuarioId).subscribe(amigos => {
        this.amigos = amigos.map(amigo => ({
          UsuarioApodo: amigo.usuarioApodo,
          UsuarioId: amigo.usuarioId,
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
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
  
  vistaActiva: string = 'amigos'; 

  usuarioApodo: string = ''; 
  usuarioFotoPerfil: string = '';

  constructor(
    private webSocketService: WebsocketService, 
    private apiService: ApiService, 
    private authService: AuthService, 
    private router: Router
  ) { }

  ngOnInit(): void {
    this.obtenerUsuarios();
    this.cargarInfoUsuario(); 
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

  async obtenerUsuarios(): Promise<void> {
    const result = await this.apiService.getUsuarios();
    if (result.isSuccess()) {
      this.usuarios = result.getData() || []; 
      this.usuariosFiltrados = this.usuarios; 
    } else {
      console.error('Error al obtener usuarios:', result.getError());
    }
  }

  buscarUsuarios(): void {
    if (this.terminoBusqueda) {
      this.usuariosFiltrados = this.usuarios.filter(usuario =>
        usuario.UsuarioApodo.toLowerCase().includes(this.terminoBusqueda.toLowerCase())
      );
    } else {
      this.usuariosFiltrados = this.usuarios;
    }
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
    } else {
      console.error('No se pudo obtener la información del usuario desde el token.');
    }
  }
}
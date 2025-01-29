import { Component, OnDestroy, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import {Subscription} from 'rxjs';
import { WebsocketService } from '../../services/websocket.service';

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './menu.component.html',
  styleUrl: './menu.component.css'
})
export class MenuComponent implements OnInit, OnDestroy {

  message: string = '';
  serverResponse: string = '';
  isConnected: boolean = false;
  connected$: Subscription;
  messageReceived$: Subscription;
  disconnected$: Subscription;
  type: 'rxjs';

  constructor(private webSocketService: WebsocketService) { }

  ngOnInit(): void {
    this.connected$ = this.webSocketService.connected.subscribe(() => this.isConnected = true);
    this.messageReceived$ = this.webSocketService.messageReceived.subscribe(message => this.serverResponse = message);
    this.disconnected$ = this.webSocketService.disconnected.subscribe(() => this.isConnected = false);
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

 
  amigos = [
    { nombre: 'Amigo 1' },
    { nombre: 'Amigo 2' },
    { nombre: 'Amigo 3' }
  ];


  solicitudesPendientes = [
    { nombre: 'Usuario 1' },
    { nombre: 'Usuario 2' }
  ];


  cambiarSeccion(seccion: string) {
    this.activeSection = seccion;
  }

  
  eliminarAmigo(amigo: any) {
    if (confirm(`¿Estás seguro de que quieres eliminar a ${amigo.nombre}?`)) {
      this.amigos = this.amigos.filter(a => a !== amigo);
    }
  }


  aceptarSolicitud(solicitud: any) {
    this.amigos.push(solicitud); 
    this.solicitudesPendientes = this.solicitudesPendientes.filter(s => s !== solicitud); // Eliminar de las solicitudes
    alert(`${solicitud.nombre} ha sido añadido a tus amigos.`);
  }


  rechazarSolicitud(solicitud: any) {
    this.solicitudesPendientes = this.solicitudesPendientes.filter(s => s !== solicitud); // Eliminar de las solicitudes
    alert(`Solicitud de ${solicitud.nombre} rechazada.`);
  }

 
  cerrarSesion() {
   
    console.log('Sesión cerrada');
    alert('Has cerrado sesión.');
  }


 
}
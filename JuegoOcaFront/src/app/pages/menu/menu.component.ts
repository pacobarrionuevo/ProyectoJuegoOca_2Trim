import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './menu.component.html',
  styleUrl: './menu.component.css'
})
export class MenuComponent {
 
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
import { Component, OnInit } from '@angular/core';
import { AdminService } from '../../services/admin.service';
import { User } from '../../models/User';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports:[CommonModule, FormsModule],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.css']
})
export class AdminComponent implements OnInit {
  usuarios: User[] = [];
  esAdmin = false;

  constructor(
    private adminService: AdminService,
    private authService: AuthService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.authService.isAdmin$.subscribe(admin => {
      this.esAdmin = admin;
      if (!admin) {
        this.router.navigate(['/']);
      } else {
        this.cargarUsuarios();
      }
    });
  }

  private cargarUsuarios(): void {
    this.adminService.getUsuarios().subscribe({
      next: (usuarios) => {
        console.log('Usuarios recibidos:', usuarios);
        this.usuarios = usuarios.map(usuario => ({
          UsuarioId: usuario.usuarioId,
          UsuarioApodo: usuario.usuarioApodo,
          UsuarioEmail: usuario.usuarioEmail,
          UsuarioFotoPerfil: usuario.usuarioFotoPerfil,
          Rol: usuario.rol,
          EstaBaneado: usuario.estaBaneado,
          EsAmigo: usuario.esAmigo
        }));
      },
      error: (err) => console.error('Error cargando usuarios:', err)
    });
  }

  cambiarRol(usuario: User): void {
    const nuevoRol = usuario.Rol === 'admin' ? 'usuario' : 'admin';
    
    if (confirm(`¿Cambiar rol de ${usuario.UsuarioApodo} a ${nuevoRol}?`)) {
      this.adminService.actualizarRol(usuario.UsuarioId!, nuevoRol).subscribe({
        
        next: (actualizado) => {
          usuario.Rol = actualizado.Rol;
        },
        error: (err) => console.error('Error actualizando rol:', err)
      });
    }
  }

  toggleBaneo(usuario: User): void {
    const accion = usuario.EstaBaneado ? 'desbanear' : 'banear';
    
    if (confirm(`¿Estás seguro de querer ${accion} a ${usuario.UsuarioApodo}?`)) {
      if (!usuario.UsuarioId) {
        console.error('El ID del usuario es undefined');
        return;
      }
  
      this.adminService.toggleBaneo(usuario.UsuarioId).subscribe({
        next: (actualizado) => {
          usuario.EstaBaneado = actualizado.EstaBaneado;
        },
        error: (err) => console.error('Error cambiando estado de baneo:', err)
      });
    }
  }
}
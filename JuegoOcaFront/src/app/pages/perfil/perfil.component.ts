  import { Component, OnInit } from '@angular/core';
  import { ActivatedRoute, Router } from '@angular/router';
  import { AuthService } from '../../services/auth.service';
  import { ApiService } from '../../services/api.service';
  import { FormBuilder, FormGroup, Validators } from '@angular/forms';
  import { CommonModule } from '@angular/common';
  import { FormsModule, ReactiveFormsModule } from '@angular/forms';
  import { User } from '../../models/User';
import { UsuarioServerResponse } from '../../models/user-server-response';

  @Component({
    selector: 'app-perfil',
    templateUrl: './perfil.component.html',
    styleUrls: ['./perfil.component.css'],
    standalone: true,
    imports: [FormsModule, CommonModule, ReactiveFormsModule]
  })
  export class PerfilComponent implements OnInit {
    usuario: User | null = null;
    esPropioPerfil: boolean = false;
    perfilForm: FormGroup;
    errorMessage: string | null = null;

    constructor(
      private route: ActivatedRoute,
      private router: Router,
      private authService: AuthService,
      private apiService: ApiService,
      private fb: FormBuilder
    ) {
      this.perfilForm = this.fb.group({
        apodo: ['', Validators.required],
        email: ['', [Validators.required, Validators.email]],
        password: [''],
        confirmPassword: ['']
      });
    }

    ngOnInit(): void {
      const userId = this.route.snapshot.paramMap.get('id');
      const currentUser = this.authService.getUserDataFromToken();
    
      if (userId && currentUser) {
        this.esPropioPerfil = currentUser.id === +userId;
    
        this.apiService.getUsuarioById(+userId).subscribe({
          next: (response: UsuarioServerResponse) => {
            console.log('Respuesta del servidor:', response);
    
            // Mapea la respuesta del servidor a la interfaz User
            this.usuario = {
              UsuarioId: response.usuarioId,
              UsuarioApodo: response.usuarioApodo,
              UsuarioEmail: response.usuarioEmail,
              UsuarioFotoPerfil: response.usuarioFotoPerfil,
              UsuarioEstado: response.usuarioEstado,
              Rol: response.rol,
              EstaBaneado: response.estaBaneado,
              EsAmigo: response.esAmigo
            };
    
            this.perfilForm.patchValue({
              avatar: this.usuario.UsuarioFotoPerfil,
              apodo: this.usuario.UsuarioApodo,
              email: this.usuario.UsuarioEmail
            });
          },
          error: (err) => {
            console.error('Error cargando el perfil:', err);
            this.router.navigate(['/menu']);
          }
        });
      } else {
        this.router.navigate(['/menu']);
      }
    }

    onSubmit(): void {
      if (this.perfilForm.valid && this.usuario) {
        const formData = this.perfilForm.value;
    
        if (formData.password && formData.password !== formData.confirmPassword) {
          this.errorMessage = 'Las contraseñas no coinciden';
          return;
        }
    
        const datosActualizacion = {
          UsuarioApodo: formData.apodo,
          UsuarioEmail: formData.email,
          UsuarioContrasena: formData.password,
          UsuarioConfirmarContrasena: formData.confirmPassword
        };
    
        console.log('ID del usuario:', this.usuario.UsuarioId); // Usa usuarioId en minúscula
        if (!this.usuario.UsuarioId) {
          console.error('El ID del usuario es undefined');
          return;
        }
    
        this.apiService.actualizarUsuario(this.usuario.UsuarioId, datosActualizacion).subscribe({
          next: () => {
            if (formData.password) {
              this.authService.logout();
              this.router.navigate(['/login']);
            } else {
              this.errorMessage = null;
              this.ngOnInit(); // Recargar el componente para reflejar los cambios
            }
          },
          error: (err) => {
            console.error('Error actualizando el perfil:', err);
            this.errorMessage = 'Error al actualizar el perfil';
          }
        });
      } else {
        console.error('El formulario no es válido o el usuario es nulo.');
      }
    }

    eliminarAvatar(): void {
      if (this.usuario) {
        this.apiService.eliminarAvatar(this.usuario.UsuarioId!).subscribe({
          next: () => {
            this.usuario!.UsuarioFotoPerfil = 'default.png';
            this.perfilForm.patchValue({ avatar: 'default.png' });
          },
          error: (err) => {
            console.error('Error eliminando el avatar:', err);
            this.errorMessage = 'Error al eliminar el avatar';
          }
        });
      }
    }

    onFileChange(event: any): void {
      const file = event.target.files[0];
      if (file) {
        const formData = new FormData();
        formData.append('avatar', file);

        this.apiService.subirAvatar(this.usuario!.UsuarioId!, formData).subscribe({
          next: (response) => {
            this.usuario!.UsuarioFotoPerfil = response.fotoPerfil;
            this.perfilForm.patchValue({ avatar: response.fotoPerfil });
          },
          error: (err) => {
            console.error('Error subiendo el avatar:', err);
            this.errorMessage = 'Error al subir el avatar';
          }
        });
      }
    }
  }
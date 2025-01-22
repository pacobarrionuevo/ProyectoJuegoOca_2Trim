import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { AuthRequest } from '../../models/auth-request';
import { Image } from '../../models/image';
import { ImageService } from '../../services/image.service';
import { CreateOrUpdateImageRequest } from '../../models/create-update-imagen-request';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [RouterModule, FormsModule, ReactiveFormsModule],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css'
})
export class RegisterComponent implements OnInit {

  @ViewChild('addEditDialog')
  addOrEditDialog: ElementRef<HTMLDialogElement>;

  @ViewChild('removeDialog')
  deleteDialog: ElementRef<HTMLDialogElement>;

  images: Image[] = [];

  addOrEditForm: FormGroup;
  imageToEdit: Image = null;
  imageToDelete: Image = null;

  apodo: string = '';
  email: string = '';
  contrasena: string = '';
  confirmar_contrasena: string = '';
  foto_perfil: string = '';
  jwt: string | null = null; 

  constructor(private authService: AuthService, private router: Router, private imageService: ImageService, private formBuilder: FormBuilder) {}

  ngOnInit(): void {
    this.jwt = localStorage.getItem('accessToken'); 

    this.addOrEditForm = this.formBuilder.group({
      Apodo: [''],
      Email: [''],
      Password: [''],
      ConfirmarPassword: [''],
      file: [null]
    });
  }

  openDialog(dialogRef: ElementRef<HTMLDialogElement>) {
    dialogRef.nativeElement.showModal();
  }

  closeDialog(dialogRef: ElementRef<HTMLDialogElement>) {
    dialogRef.nativeElement.close();
  }

  onFileSelected(event: any) {
    const image = event.target.files[0] as File; // Here we use only the first file (single file)
    this.addOrEditForm.patchValue({ file: image });
  }

  async upateImageList() {
    const request = await this.imageService.getAllImages();

    if (request.success) {
      this.images = request.data;
    }
  }

  async createOrUpdateImage() {
    const createOrUpdateImageRequest: CreateOrUpdateImageRequest = {
      name: this.addOrEditForm.get('name')?.value,
      file: this.addOrEditForm.get('file')?.value as File
    };

    // Añadir nueva imagen
    if (this.imageToEdit == null) {
      const request = await this.imageService.addImage(createOrUpdateImageRequest);

      if (request.success) {
        alert('Imagen añadida con éxito');
        this.closeDialog(this.addOrEditDialog);
        this.upateImageList();
      } else {
        alert(`Ha ocurrido un error: ${request.error}`)
      }
    } 
    // Actualizar imagen existente
    else {
      const request = await this.imageService.updateImage(this.imageToEdit.id, createOrUpdateImageRequest);

      if (request.success) {
        alert('Imagen actualizada con éxito');
        this.closeDialog(this.addOrEditDialog);
        this.upateImageList();
      } else {
        alert(`Ha ocurrido un error: ${request.error}`)
      }
    }
  }

  async submit() {
    const authData: AuthRequest = {
      UsuarioApodo: this.apodo,
      UsuarioEmail: this.email,
      UsuarioContrasena: this.contrasena,
      UsuarioConfirmarContrasena: this.confirmar_contrasena,
      UsuarioFotoPerfil: this.foto_perfil
    };
  

    try {
      const result = await this.authService.register(authData).toPromise();
      if (result) {
        localStorage.setItem('accessToken', result.stringToken);
        this.jwt = result.stringToken;
        console.log("Registro exitoso.");
        this.router.navigate(['/login']);
      } else {
        console.error("No se recibió un token de acceso.");
      }
    } catch (error) {
      console.error("Error al registrar:", error);
    }
  }
}
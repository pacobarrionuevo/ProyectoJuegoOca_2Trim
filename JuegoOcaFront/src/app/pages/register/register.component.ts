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
    const image = event.target.files[0] as File;
    this.addOrEditForm.patchValue({ file: image });
  }

  async upateImageList() {
    const request = await this.imageService.getAllImages();

    if (request.success) {
      this.images = request.data;
    }
  }

  async submit() {
    const file = this.addOrEditForm.get('file')?.value as File;
  
    if (!file) {
      alert("Por favor, selecciona una foto de perfil.");
      return;
    }
  
    const formData = new FormData();
    formData.append('UsuarioApodo', this.addOrEditForm.get('Apodo')?.value);
    formData.append('UsuarioEmail', this.addOrEditForm.get('Email')?.value);
    formData.append('UsuarioContrasena', this.addOrEditForm.get('Password')?.value);
    formData.append('UsuarioConfirmarContrasena', this.addOrEditForm.get('ConfirmarPassword')?.value);
    formData.append('UsuarioFotoPerfil', file);
  
    try {
      const result = await this.authService.register(formData).toPromise();
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
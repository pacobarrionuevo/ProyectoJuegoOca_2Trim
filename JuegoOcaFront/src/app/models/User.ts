export interface User {
    UsuarioId?: number;
    UsuarioApodo?: string;
    UsuarioEmail?: string;
    UsuarioFotoPerfil?: string; 
    UsuarioContrasena?: string; 
    UsuarioConfirmarContrasena?: string;
    Rol?: 'usuario' | 'admin';
    EstaBaneado?: boolean;
    UsuarioEstado?: string; 

  }
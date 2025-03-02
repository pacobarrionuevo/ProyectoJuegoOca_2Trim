export interface UsuarioServerResponse {
    usuarioId?: number;
    usuarioApodo?: string;
    usuarioEmail?: string;
    usuarioFotoPerfil?: string;
    usuarioEstado?: string;
    rol?: 'usuario' | 'admin';
    estaBaneado?: boolean;
    esAmigo?: boolean;
  }
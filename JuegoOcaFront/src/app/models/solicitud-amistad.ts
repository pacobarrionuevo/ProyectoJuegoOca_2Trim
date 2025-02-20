export interface SolicitudAmistad {
    amistadId: number;
    // Este será el usuario de interés; por ejemplo, el que envió la solicitud (si lo deseas) o el receptor
    usuarioId: number;
    usuarioApodo: string;
    usuarioFotoPerfil?: string;
  }
  
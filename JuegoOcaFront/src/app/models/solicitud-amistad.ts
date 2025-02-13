export interface SolicitudAmistad {
    amistad: { AmistadId: number };
    usuario: { UsuarioId: number; UsuarioApodo: string; UsuarioFotoPerfil?: string };
}

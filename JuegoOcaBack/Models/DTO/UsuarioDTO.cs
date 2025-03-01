namespace JuegoOcaBack.Models.DTO
{
    public class UsuarioDTO
    {
        public int UsuarioId { get; set; }
        public string UsuarioFotoPerfil { get; set; } // Archivo de la imagen
        public string UsuarioApodo { get; set; }
        public string UsuarioEmail { get; set; }
        public string UsuarioContrasena { get; set; }
        public string UsuarioConfirmarContrasena { get; set; }
        public string UsuarioEstado { get; set; }
        public string Rol { get; set; }
        public bool EstaBaneado { get; set; }
    }
}

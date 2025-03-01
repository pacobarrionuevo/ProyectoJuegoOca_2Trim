namespace JuegoOcaBack.Models.Database.Entidades
{
    public class Usuario
    {
        public int UsuarioId { get; set; }
        public string UsuarioFotoPerfil { get; set; }
        public string UsuarioApodo { get; set; }
        public string UsuarioEmail { get; set; }
        public string UsuarioContrasena { get; set; }
        public string UsuarioConfirmarContrasena { get; set; }

        public List<UsuarioTieneAmistad> UsuarioAmistad { get; set; }

        public string UsuarioEstado { get; set; }
        public string Rol { get; set; }
        public bool EstaBaneado { get; set; }
    }
}

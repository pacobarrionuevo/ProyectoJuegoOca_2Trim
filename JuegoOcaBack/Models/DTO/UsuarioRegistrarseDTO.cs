namespace JuegoOcaBack.Models.DTO
{
    public class UsuarioRegistrarseDTO
    {
        public IFormFile UsuarioFotoPerfil { get; set; } //Archivo de PFP
        public string UsuarioApodo { get; set; }
        public string UsuarioEmail { get; set; }
        public string UsuarioContrasena { get; set; }
        public string UsuarioConfirmarContrasena { get; set; }
    }
}

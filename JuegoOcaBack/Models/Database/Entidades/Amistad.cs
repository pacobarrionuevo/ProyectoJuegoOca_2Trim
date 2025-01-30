namespace JuegoOcaBack.Models.Database.Entidades
{
    public class Amistad
    {
        public int AmistadId { get; set; }
        public bool IsAccepted { get; set; } = false;
        public List<UsuarioTieneAmistad> AmistadUsuario { get; set; }
    }
}

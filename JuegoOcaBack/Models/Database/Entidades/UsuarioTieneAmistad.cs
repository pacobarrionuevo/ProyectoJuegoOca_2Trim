namespace JuegoOcaBack.Models.Database.Entidades
{
    public class UsuarioTieneAmistad
    {
        public int UsuarioId { get; set; }
        public int AmistadId { get; set; }
        public int UsuarioTieneAmistadId { get; set; }

        public Usuario usuario { get; set; }
        public Amistad amistad { get; set; }
    }
}

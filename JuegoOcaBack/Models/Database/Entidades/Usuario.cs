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

        //Ahora nos pasamos al inglés, cambiar código 
        public List<Friendship> Friendships { get; set; } = new List<Friendship>();
        public List<FriendRequest> RequestsSent { get; set; } = new List<FriendRequest>();
        public List<FriendRequest> RequestsReceived { get; set; } = new List<FriendRequest>();

    }
}

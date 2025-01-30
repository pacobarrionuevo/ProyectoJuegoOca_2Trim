namespace JuegoOcaBack.Models.Database.Entidades
{
    public class Friendship
    {
        public int FriendshipId { get; set; }
        public List<Usuario> Users { get; set; }
        public bool IsAccepted { get; set; } = false;        

    }
}

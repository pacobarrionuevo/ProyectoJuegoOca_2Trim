namespace JuegoOcaBack.Models.Database.Entidades
{
    public class Friendship
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public Usuario User { get; set; }

        public int FriendId { get; set; }
        public Usuario Friend { get; set; }
    }
}

namespace JuegoOcaBack.Models.Database.Entidades
{
    public class FriendRequest
    {
        public int Id { get; set; }
        public int SenderId { get; set; }
        public int ReceiverId { get; set; }

        public Usuario Sender { get; set; }
        public Usuario Receiver { get; set; }
        public bool Accepted { get; set; }
    }
}

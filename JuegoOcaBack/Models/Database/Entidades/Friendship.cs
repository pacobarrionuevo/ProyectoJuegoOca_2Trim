namespace JuegoOcaBack.Models.Database.Entidades
{
    public class Friendship
    {
        public int User1 { get; set; }
        public int User2 { get; set; }
        public bool IsAccepted { get; set; }

        public Friendship(int user1, int user2, bool isAccepted)
        {
            User1 = user1;
            User2 = user2;
            IsAccepted = isAccepted;
        }

        public bool IsFriend(int user1, int user2)
        {
            return false;
        }
    }
}

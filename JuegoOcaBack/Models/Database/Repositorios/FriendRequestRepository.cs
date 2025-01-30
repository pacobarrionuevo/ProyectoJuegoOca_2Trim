using JuegoOcaBack.Models.Database.Entidades;

namespace JuegoOcaBack.Models.Database.Repositorios
{
    public class FriendRequestRepository : Repositorio<Friendship>
    {
        public FriendRequestRepository(DBContext context) : base(context) { }
    }
}

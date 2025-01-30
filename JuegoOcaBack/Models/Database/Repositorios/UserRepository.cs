using JuegoOcaBack.Models.Database.Entidades;

namespace JuegoOcaBack.Models.Database.Repositorios
{
    public class UserRepository: Repositorio<Usuario>
    {
        public UserRepository(DBContext context) : base(context) { }
    }
}

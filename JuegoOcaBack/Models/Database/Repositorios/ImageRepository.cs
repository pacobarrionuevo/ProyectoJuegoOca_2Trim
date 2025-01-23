using JuegoOcaBack.Models.Database.Entidades;

namespace JuegoOcaBack.Models.Database.Repositorios
{
    public class ImageRepository: Repositorio<Image>
    {
        public  ImageRepository(DBContext context): base(context) { }
    }
}

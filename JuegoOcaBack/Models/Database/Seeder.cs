using JuegoOcaBack.Models.Database.Entidades;
using JuegoOcaBack.Recursos;

namespace JuegoOcaBack.Models.Database
{
    public class Seeder
    {
        private readonly DBContext _dBContext;

        public Seeder(DBContext dbContext)
        {
            _dBContext = dbContext;
        }

        public async Task SeedAsync()
        {
            await SeedImagesAsync();
            await _dBContext.SaveChangesAsync();
        }

        private async Task SeedImagesAsync()
        {
            Usuario[] usuarios = new Usuario[]
            {
                new Usuario() { UsuarioId = 1, UsuarioApodo = "Paco", UsuarioEmail = "paco@gmail.com" , UsuarioContrasena = PasswordHelper.Hash("paco33"), UsuarioConfirmarContrasena = PasswordHelper.Hash("paco33"), UsuarioFotoPerfil = "prueba" }
            };

            await _dBContext.AddRangeAsync(usuarios);
        }
    }
}

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
            Usuario usuario1 = new Usuario()
            {
                UsuarioId = 1,
                UsuarioApodo = "Paco",
                UsuarioEmail = "paco@gmail.com",
                UsuarioContrasena = PasswordHelper.Hash("paco33"),
                UsuarioConfirmarContrasena = PasswordHelper.Hash("paco33"),
                UsuarioFotoPerfil = "prueba"
            };

            Usuario usuario2 = new Usuario()
            {
                UsuarioId = 2,
                UsuarioApodo = "Salguero",
                UsuarioEmail = "salguero@gmail.com",
                UsuarioContrasena = PasswordHelper.Hash("salguero33"),
                UsuarioConfirmarContrasena = PasswordHelper.Hash("salguero33"),
                UsuarioFotoPerfil = "prueba"
            };


            Friendship amistad1 = new Friendship()
            {
                FriendshipId = 1,
                Users = new List<Usuario> { usuario1, usuario2 },
                IsAccepted = true
            };

            Friendship solicitud1 = new Friendship()
            {
                FriendshipId = 2,
                Users = new List<Usuario> { usuario1, usuario2 },
                IsAccepted = false
            };

            usuario1.Friendships.Add(amistad1);
            usuario1.RequestsSent.Add(solicitud1);

            usuario2.Friendships.Add(amistad1);
            usuario2.RequestsReceived.Add(solicitud1);

            // Insertar usuarios y relaciones en la base de datos
            await _dBContext.AddRangeAsync(usuario1, usuario2, amistad1, solicitud1);
            await _dBContext.SaveChangesAsync();
        }
    }
}

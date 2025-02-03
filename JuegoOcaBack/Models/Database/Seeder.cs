using JuegoOcaBack.Models.Database.Entidades;
using JuegoOcaBack.Recursos;
using System.Collections.Generic;
using System.Threading.Tasks;

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
            // Crear usuarios
            Usuario usuario1 = new Usuario()
            {
                UsuarioId = 1,
                UsuarioApodo = "Paco",
                UsuarioEmail = "paco@gmail.com",
                UsuarioContrasena = PasswordHelper.Hash("paco33"),
                UsuarioConfirmarContrasena = PasswordHelper.Hash("paco33"),
                UsuarioFotoPerfil = "prueba",
                UsuarioAmistad = new List<UsuarioTieneAmistad>()
            };

            Usuario usuario2 = new Usuario()
            {
                UsuarioId = 2,
                UsuarioApodo = "Salguero",
                UsuarioEmail = "salguero@gmail.com",
                UsuarioContrasena = PasswordHelper.Hash("salguero33"),
                UsuarioConfirmarContrasena = PasswordHelper.Hash("salguero33"),
                UsuarioFotoPerfil = "prueba",
                UsuarioAmistad = new List<UsuarioTieneAmistad>()
            };

            Usuario usuario3 = new Usuario()
            {
                UsuarioId = 3,
                UsuarioApodo = "Laura",
                UsuarioEmail = "laura@gmail.com",
                UsuarioContrasena = PasswordHelper.Hash("laura33"),
                UsuarioConfirmarContrasena = PasswordHelper.Hash("laura33"),
                UsuarioFotoPerfil = "prueba",
                UsuarioAmistad = new List<UsuarioTieneAmistad>()
            };

            Usuario usuario4 = new Usuario()
            {
                UsuarioId = 4,
                UsuarioApodo = "Carlos",
                UsuarioEmail = "carlos@gmail.com",
                UsuarioContrasena = PasswordHelper.Hash("carlos33"),
                UsuarioConfirmarContrasena = PasswordHelper.Hash("carlos33"),
                UsuarioFotoPerfil = "prueba",
                UsuarioAmistad = new List<UsuarioTieneAmistad>()
            };

            // Crear amistad entre usuario1 y usuario2
            Amistad amistad1 = new Amistad()
            {
                AmistadId = 1,
                IsAccepted = true,
                AmistadUsuario = new List<UsuarioTieneAmistad>()
            };

            UsuarioTieneAmistad uta1 = new UsuarioTieneAmistad()
            {
                UsuarioId = usuario1.UsuarioId,
                AmistadId = amistad1.AmistadId,
                usuario = usuario1,
                amistad = amistad1
            };

            UsuarioTieneAmistad uta2 = new UsuarioTieneAmistad()
            {
                UsuarioId = usuario2.UsuarioId,
                AmistadId = amistad1.AmistadId,
                usuario = usuario2,
                amistad = amistad1
            };

            amistad1.AmistadUsuario.Add(uta1);
            amistad1.AmistadUsuario.Add(uta2);

            usuario1.UsuarioAmistad.Add(uta1);
            usuario2.UsuarioAmistad.Add(uta2);

            // Insertar usuarios y relaciones en la base de datos
            await _dBContext.AddRangeAsync(usuario1, usuario2, usuario3, usuario4, amistad1, uta1, uta2);
            await _dBContext.SaveChangesAsync();
        }
    }
}
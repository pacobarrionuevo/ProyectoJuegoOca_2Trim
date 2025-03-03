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
            // Todos los usuarios
            Usuario usuario1 = new Usuario()
            {
                UsuarioId = 1,
                UsuarioApodo = "Jose",
                UsuarioEmail = "jose777@gmail.com",
                UsuarioContrasena = PasswordHelper.Hash("jose777"),
                UsuarioConfirmarContrasena = PasswordHelper.Hash("jose777"),
                UsuarioFotoPerfil = "Perfil_Deffault.png",
                UsuarioAmistad = new List<UsuarioTieneAmistad>(),
                UsuarioEstado = "Desconectado",
                Rol = "admin",
                EstaBaneado = false
            };

            Usuario usuario2 = new Usuario()
            {
                UsuarioId = 2,
                UsuarioApodo = "Salguero",
                UsuarioEmail = "salguero@gmail.com",
                UsuarioContrasena = PasswordHelper.Hash("salguero33"),
                UsuarioConfirmarContrasena = PasswordHelper.Hash("salguero33"),
                UsuarioFotoPerfil = "Perfil_Deffault.png",
                UsuarioAmistad = new List<UsuarioTieneAmistad>(),
                UsuarioEstado = "Desconectado",
                 Rol = "admin",
                EstaBaneado = false,

            };

            

            // Amistad entre usuario1 y usuario2
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
                amistad = amistad1,
                esQuienMandaSolicitud = true
            };

            UsuarioTieneAmistad uta2 = new UsuarioTieneAmistad()
            {
                UsuarioId = usuario2.UsuarioId,
                AmistadId = amistad1.AmistadId,
                usuario = usuario2,
                amistad = amistad1,
                esQuienMandaSolicitud = false
            };

            // Amistad entre usuario 3 y 4
            Amistad amistad2 = new Amistad()
            {
                AmistadId = 2,
                IsAccepted = true,
                AmistadUsuario = new List<UsuarioTieneAmistad>()
            };


            amistad1.AmistadUsuario.Add(uta1);
            amistad1.AmistadUsuario.Add(uta2);
            

            usuario1.UsuarioAmistad.Add(uta1);
            usuario2.UsuarioAmistad.Add(uta2);
           

            // Insertar usuarios y relaciones en la base de datos
            await _dBContext.AddRangeAsync(usuario1, usuario2, amistad1, uta1, uta2);
            await _dBContext.SaveChangesAsync();
        }
    }
}
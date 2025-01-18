using JuegoOcaBack.Extensions;
using JuegoOcaBack.Models.Database.Entidades;

namespace JuegoOcaBack.Models.Mappers
{
    public class ImagenMapper
    {
        public IList<Usuario> AddImagenCorrecta(IList<Usuario> usuarios, HttpRequest httpRequest = null)
        {
            foreach (Usuario user in usuarios)
            {
                user.UsuarioFotoPerfil = httpRequest is null ? user.UsuarioFotoPerfil : httpRequest.GetAbsoluteUrl("images/" + user.UsuarioFotoPerfil);
            }

            return usuarios;
        }

        public Usuario AddImagenCorrecta(Usuario user, HttpRequest httpRequest = null)
        {
            string ruta = "images/" + user.UsuarioFotoPerfil;
            user.UsuarioFotoPerfil = httpRequest.GetAbsoluteUrl(ruta);
            return user;
        }
    }
}

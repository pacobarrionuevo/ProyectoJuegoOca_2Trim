using JuegoOcaBack.Models.Database;
using JuegoOcaBack.Models.Database.Entidades;
using JuegoOcaBack.Models.DTO;
using JuegoOcaBack.Recursos;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace JuegoOcaBack.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class UsuarioControlador : ControllerBase
    {   
        private readonly ProyectoDbContext _context;
        private readonly PasswordHelper passwordHelper;
        private readonly TokenValidationParameters _tokenParameters;

        public UsuarioControlador(ProyectoDbContext _dbContext, IOptionsMonitor<JwtBearerOptions> jwtOptions)
        {
            _context = _dbContext;
            _tokenParameters = jwtOptions.Get(JwtBearerDefaults.AuthenticationScheme).TokenValidationParameters;
        }

        private UsuarioDTO ToDto(Usuario users)
        {
            return new UsuarioDTO()
            {
                UsuarioId = users.UsuarioId,
                UsuarioApodo = users.UsuarioApodo,
                UsuarioEmail = users.UsuarioEmail,
                UsuarioContrasena = users.UsuarioContrasena,
                UsuarioConfirmarContrasena = users.UsuarioConfirmarContrasena,
                UsuarioFotoPerfil = users.UsuarioFotoPerfil
            };
        }

        //Endpoint que devuelve una lista de todos los usuarios
        [HttpGet("userlist")]
        public IEnumerable<UsuarioDTO> GetUser()
        {
            return _context.Usuarios.Select(ToDto);
        }

    }
}

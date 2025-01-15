using System.IdentityModel.Tokens.Jwt;
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
        private readonly DBContext _context;
        private readonly PasswordHelper passwordHelper;
        private readonly TokenValidationParameters _tokenParameters;

        public UsuarioControlador(DBContext _dbContext, IOptionsMonitor<JwtBearerOptions> jwtOptions)
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
        [HttpGet("ListaUsuario")]
        public IEnumerable<UsuarioDTO> GetUser()
        {
            return _context.Usuarios.Select(ToDto);
        }

        //Metodo para registrar usuario
        [HttpPost("Registro")]
        public async Task<IActionResult> Register([FromBody] UsuarioDTO usuario)
        {
            //Comprobacion de que no exista ya un usuario con el mismo email.
            if (_context.Usuarios.Any(Usuario => Usuario.UsuarioEmail == usuario.UsuarioEmail))
            {
                return BadRequest("El nombre del usuario ya está en uso");
            
            }
            
            // Si las contraseñas no coinciden, no deja hacer el registro
            if (usuario.UsuarioContrasena != usuario.UsuarioConfirmarContrasena)
            {
                return BadRequest("Las contraseñas no coinciden");
            }

            //Crea el usuario, lo almacena y lo mappea con el DTO
            Usuario newUser = new Usuario()
            {
                UsuarioApodo = usuario.UsuarioApodo,
                UsuarioEmail = usuario.UsuarioEmail,
                UsuarioContrasena = PasswordHelper.Hash(usuario.UsuarioContrasena),
                UsuarioConfirmarContrasena = PasswordHelper.Hash(usuario.UsuarioConfirmarContrasena),
                UsuarioFotoPerfil = usuario.UsuarioFotoPerfil
            };

            await _context.Usuarios.AddAsync(newUser);
            await _context.SaveChangesAsync();
            UsuarioDTO userCreated = ToDto(newUser);

            //Token, y le pasamos por claims todo lo que necesitamos para varias clases, como la vista admin (ej.)
            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Claims = new Dictionary<string, object>
                {
                    {"id", newUser.UsuarioId},
                    {"Nombre", newUser.UsuarioApodo},
                    {"Email", newUser.UsuarioEmail},
                    {"FotoPerfil", newUser.UsuarioFotoPerfil}
                },
                Expires = DateTime.UtcNow.AddDays(5),
                SigningCredentials = new SigningCredentials(
                    _tokenParameters.IssuerSigningKey,
                    SecurityAlgorithms.HmacSha256Signature)
            };

            //Crea el token lo guarda lo hashea y da OK
            JwtSecurityTokenHandler tokenHandler = new JwtSecurityTokenHandler();
            SecurityToken token = tokenHandler.CreateToken(tokenDescriptor);
            string accessToken = tokenHandler.WriteToken(token);
            return Ok(new { StringToken = accessToken });
        }

    }
}

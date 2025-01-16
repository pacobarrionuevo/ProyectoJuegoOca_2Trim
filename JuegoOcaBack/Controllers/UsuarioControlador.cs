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
using System.Text.RegularExpressions;

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

        private UsuarioRegistrarseDTO ToDtoRegistro(Usuario users)
        {
            return new UsuarioRegistrarseDTO()
            {
                UsuarioApodo = users.UsuarioApodo,
                UsuarioEmail = users.UsuarioEmail,
                UsuarioContrasena = users.UsuarioContrasena,
                UsuarioConfirmarContrasena = users.UsuarioConfirmarContrasena,
                UsuarioFotoPerfil = users.UsuarioFotoPerfil
            };
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

        [HttpGet("ListaUsuario")]
        public IEnumerable<UsuarioDTO> GetUser()
        {
            return _context.Usuarios.Select(ToDto);
        }

        [HttpPost("Registro")]
        public async Task<IActionResult> Register([FromBody] UsuarioRegistrarseDTO usuario)
        {
            if (_context.Usuarios.Any(Usuario => Usuario.UsuarioEmail == usuario.UsuarioEmail))
            {
                return BadRequest("El nombre del usuario ya está en uso");
            }

            if (usuario.UsuarioContrasena != usuario.UsuarioConfirmarContrasena)
            {
                return BadRequest("Las contraseñas no coinciden");
            }

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
            UsuarioRegistrarseDTO userCreated = ToDtoRegistro(newUser);

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

            JwtSecurityTokenHandler tokenHandler = new JwtSecurityTokenHandler();
            SecurityToken token = tokenHandler.CreateToken(tokenDescriptor);
            string accessToken = tokenHandler.WriteToken(token);
            return Ok(new { StringToken = accessToken });
        }

        [HttpPost("login")]
        public IActionResult Login([FromBody] UsuarioLoginDTO usuarioLoginDto)
        {
            string emailPattern = @"^[^@\s]+@[^@\s]+\.[^@\s]+$";
            Usuario user;

            // Comprueba si el input del usuario es un email o un apodo
            if (Regex.IsMatch(usuarioLoginDto.UsuarioEmailOApodo, emailPattern))
            {
                // Busca por email
                user = _context.Usuarios.FirstOrDefault(u => u.UsuarioEmail == usuarioLoginDto.UsuarioEmailOApodo);
            }
            else
            {
                // Busca por apodo
                user = _context.Usuarios.FirstOrDefault(u => u.UsuarioApodo == usuarioLoginDto.UsuarioEmailOApodo);
            }

            if (user == null)
            {
                return Unauthorized("Usuario no existe");
            }

            if (!PasswordHelper.Hash(usuarioLoginDto.UsuarioContrasena).Equals(user.UsuarioContrasena))
            {
                return Unauthorized("Contraseña incorrecta");
            }

            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Claims = new Dictionary<string, object>
        {
            {"id", user.UsuarioId},
            {"Apodo", user.UsuarioApodo},
            {"Email", user.UsuarioEmail},
        },
                Expires = DateTime.UtcNow.AddDays(5),
                SigningCredentials = new SigningCredentials(
                    _tokenParameters.IssuerSigningKey,
                    SecurityAlgorithms.HmacSha256Signature)
            };

            JwtSecurityTokenHandler tokenHandler = new JwtSecurityTokenHandler();
            SecurityToken token = tokenHandler.CreateToken(tokenDescriptor);
            string accessToken = tokenHandler.WriteToken(token);

            return Ok(new { StringToken = accessToken, user.UsuarioId });
        }

    }
}

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
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.EntityFrameworkCore;

namespace JuegoOcaBack.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class UsuarioController : ControllerBase
    {
        private readonly DBContext _context;
        private readonly PasswordHelper passwordHelper;
        private readonly TokenValidationParameters _tokenParameters;

        public UsuarioController(DBContext _dbContext, IOptionsMonitor<JwtBearerOptions> jwtOptions)
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
                UsuarioFotoPerfil = null
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
                UsuarioFotoPerfil = users.UsuarioFotoPerfil,
                UsuarioEstado = users.UsuarioEstado
            };
        }

        [HttpGet("usuarios")]
        public async Task<ActionResult<IEnumerable<UsuarioDTO>>> GetUsuarios()
        {
            return await _context.Usuarios
                .Select(u => new UsuarioDTO
                {
                    UsuarioId = u.UsuarioId,
                    UsuarioApodo = u.UsuarioApodo,
                    UsuarioEmail = u.UsuarioEmail,
                    UsuarioFotoPerfil = u.UsuarioFotoPerfil,
                    Rol = u.Rol,
                    EstaBaneado = u.EstaBaneado
                })
                .ToListAsync();
        }

        [HttpPatch("usuarios/{id}/rol")]
        public async Task<IActionResult> ActualizarRol(int id, [FromBody] ActualizarRolDTO dto)
        {
            var usuario = await _context.Usuarios.FindAsync(id);
            if (usuario == null) return NotFound();

            usuario.Rol = dto.NuevoRol;
            await _context.SaveChangesAsync();

            return Ok(usuario);
        }

        [HttpPatch("usuarios/{id}/baneo")]
        public async Task<IActionResult> ToggleBaneo(int id)
        {
            var usuario = await _context.Usuarios.FindAsync(id);
            if (usuario == null) return NotFound();

            usuario.EstaBaneado = !usuario.EstaBaneado;
            await _context.SaveChangesAsync();

            return Ok(usuario);
        }


        [HttpPost("Registro")]  
        public async Task<IActionResult> Register([FromForm] UsuarioRegistrarseDTO usuario)
        {
            if (_context.Usuarios.Any(Usuario => Usuario.UsuarioEmail == usuario.UsuarioEmail))
            {
                return BadRequest("El nombre del usuario ya está en uso");
            }

            if (usuario.UsuarioContrasena != usuario.UsuarioConfirmarContrasena)
            {
                return BadRequest("Las contraseñas no coinciden");
            }

            if (usuario.UsuarioFotoPerfil == null || usuario.UsuarioFotoPerfil.Length == 0)
            {
                return BadRequest("No se ha elegido foto de perfil");
            }

            //Eso guarda la ruta
            string rutaFotoPerfil = $"{Guid.NewGuid()}_{usuario.UsuarioFotoPerfil.FileName}"; 
            await StoreImageAsync("fotos/"+ rutaFotoPerfil, usuario.UsuarioFotoPerfil);

            Usuario newUser = new Usuario()
            {
                UsuarioApodo = usuario.UsuarioApodo,
                UsuarioEmail = usuario.UsuarioEmail,
                UsuarioContrasena = PasswordHelper.Hash(usuario.UsuarioContrasena),
                UsuarioConfirmarContrasena = PasswordHelper.Hash(usuario.UsuarioConfirmarContrasena),
                UsuarioFotoPerfil = rutaFotoPerfil,
                UsuarioEstado = "Conectado"
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
                    {"FotoPerfil", newUser.UsuarioFotoPerfil},
                    {"Rol", newUser.Rol},
                    {"EstaBaneado", newUser.EstaBaneado}

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
                    {"FotoPerfil",user.UsuarioFotoPerfil},
                    {"Rol",user.Rol},
                    {"EstaBaneado",user.EstaBaneado}
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

        [HttpGet("usuarios/{id}")]
        public async Task<ActionResult<UsuarioDTO>> GetUsuarioById(int id)
        {
            var usuario = await _context.Usuarios
                .Include(u => u.UsuarioAmistad)
                .ThenInclude(ua => ua.amistad)
                .FirstOrDefaultAsync(u => u.UsuarioId == id);

            if (usuario == null)
            {
                return NotFound("Usuario no encontrado");
            }

            var usuarioDto = new UsuarioDTO
            {
                UsuarioId = usuario.UsuarioId,
                UsuarioApodo = usuario.UsuarioApodo,
                UsuarioEmail = usuario.UsuarioEmail,
                UsuarioFotoPerfil = usuario.UsuarioFotoPerfil,
                UsuarioEstado = usuario.UsuarioEstado,
                Rol = usuario.Rol,
                EstaBaneado = usuario.EstaBaneado,
                EsAmigo = usuario.UsuarioAmistad.Any(ua => ua.amistad.IsAccepted)
            };

            return Ok(usuarioDto);
        }

        [HttpPut("usuarios/{id}")]
        public async Task<IActionResult> ActualizarUsuario(int id, [FromBody] ActualizarUsuarioDTO dto)
        {
            var usuario = await _context.Usuarios.FindAsync(id);
            if (usuario == null)
            {
                return NotFound("Usuario no encontrado");
            }

            if (!string.IsNullOrEmpty(dto.UsuarioApodo))
            {
                usuario.UsuarioApodo = dto.UsuarioApodo;
            }

            if (!string.IsNullOrEmpty(dto.UsuarioEmail))
            {
                usuario.UsuarioEmail = dto.UsuarioEmail;
            }

            if (!string.IsNullOrEmpty(dto.UsuarioContrasena))
            {
                if (dto.UsuarioContrasena != dto.UsuarioConfirmarContrasena)
                {
                    return BadRequest("Las contraseñas no coinciden");
                }
                usuario.UsuarioContrasena = PasswordHelper.Hash(dto.UsuarioContrasena);
            }

            await _context.SaveChangesAsync();
            return Ok(usuario);
        }

        [HttpPost("usuarios/{id}/avatar")]
        public async Task<IActionResult> SubirAvatar(int id, IFormFile file)
        {
            var usuario = await _context.Usuarios.FindAsync(id);
            if (usuario == null)
            {
                return NotFound("Usuario no encontrado");
            }

            if (file == null || file.Length == 0)
            {
                return BadRequest("No se ha proporcionado un archivo válido");
            }

            string rutaFotoPerfil = $"{Guid.NewGuid()}_{file.FileName}";
            await StoreImageAsync("fotos/" + rutaFotoPerfil, file);

            usuario.UsuarioFotoPerfil = rutaFotoPerfil;
            await _context.SaveChangesAsync();

            return Ok(new { UsuarioFotoPerfil = usuario.UsuarioFotoPerfil });
        }

        [HttpDelete("usuarios/{id}/avatar")]
        public async Task<IActionResult> EliminarAvatar(int id)
        {
            var usuario = await _context.Usuarios.FindAsync(id);
            if (usuario == null)
            {
                return NotFound("Usuario no encontrado");
            }

            usuario.UsuarioFotoPerfil = "OcaFoto.jpg";
            await _context.SaveChangesAsync();

            return Ok(new { UsuarioFotoPerfil = usuario.UsuarioFotoPerfil });
        }

        private async Task StoreImageAsync(string relativePath, IFormFile file)
        {
            using Stream stream = file.OpenReadStream();

            await FileHelper.SaveAsync(stream, relativePath);
        }

    }
}

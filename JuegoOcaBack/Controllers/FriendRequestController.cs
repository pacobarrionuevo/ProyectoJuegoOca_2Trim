using JuegoOcaBack.Services;
using Microsoft.AspNetCore.Mvc;

namespace JuegoOcaBack.Controllers
{
    [Route("api/amigos")]
    [ApiController]
    public class FriendRequestController : ControllerBase
    {
        private readonly FriendRequestService _friendRequestService;

        public FriendRequestController(FriendRequestService friendRequestService)
        {
            _friendRequestService = friendRequestService;
        }

        [HttpPost("enviar")]
        public async Task<IActionResult> EnviarSolicitud([FromQuery] int senderId, [FromQuery] int receiverId)
        {
            var resultado = await _friendRequestService.EnviarSolicitudAsync(senderId, receiverId);
            if (!resultado)
                return BadRequest("No se pudo enviar la solicitud. Puede que ya exista.");

            return Ok("Solicitud enviada exitosamente.");
        }

        [HttpPost("aceptar")]
        public async Task<IActionResult> AceptarSolicitud([FromQuery] int senderId, [FromQuery] int receiverId)
        {
            var resultado = await _friendRequestService.AceptarSolicitudAsync(senderId, receiverId);
            if (!resultado)
                return BadRequest("No se pudo aceptar la solicitud.");

            return Ok("Solicitud aceptada exitosamente.");
        }

        [HttpDelete("eliminar")]
        public async Task<IActionResult> EliminarAmistad([FromQuery] int userId, [FromQuery] int friendId)
        {
            var resultado = await _friendRequestService.EliminarAmistadAsync(userId, friendId);
            if (!resultado)
                return BadRequest("No se pudo eliminar la amistad.");

            return Ok("Amistad eliminada exitosamente.");
        }

        [HttpGet("listar")]
        public async Task<IActionResult> ObtenerAmigos([FromQuery] int usuarioId)
        {
            var amigos = await _friendRequestService.ObtenerAmigosAsync(usuarioId);
            if (amigos == null || !amigos.Any())
                return NotFound("No se encontraron amigos.");

            return Ok(amigos);
        }
    }
}

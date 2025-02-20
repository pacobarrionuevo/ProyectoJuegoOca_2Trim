using Microsoft.AspNetCore.Mvc;
using JuegoOcaBack.Services;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using JuegoOcaBack.Models.Database.Entidades;
using Microsoft.AspNetCore.Authorization;

namespace JuegoOcaBack.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class FriendRequestController : ControllerBase
    {
        private readonly FriendRequestService _friendRequestService;

        public FriendRequestController(FriendRequestService friendRequestService)
        {
            _friendRequestService = friendRequestService;
        }

        [HttpPost("send")]
        public async Task<IActionResult> SendFriendRequest([FromQuery] int receiverId)
        {
            if (!int.TryParse(User.Claims.FirstOrDefault(c => c.Type == "id")?.Value, out var senderId))
                return Unauthorized("Usuario no autenticado.");

            if (senderId == receiverId)
                return BadRequest("No puedes enviarte una solicitud a ti mismo.");

            var result = await _friendRequestService.SendFriendRequest(senderId, receiverId);

            if (result.Success)
                return Ok(result);
            else
                return StatusCode(500, "Error al enviar la solicitud.");
        }



        [HttpPost("accept")]
        public async Task<IActionResult> AcceptFriendRequest([FromQuery] int amistadId)
        {
            if (!int.TryParse(User.Claims.FirstOrDefault(c => c.Type == "id")?.Value, out var receiverId))
                return Unauthorized("Usuario no autenticado.");

            var result = await _friendRequestService.AcceptFriendRequest(amistadId, receiverId);
            return result ? Ok() : BadRequest("No se pudo aceptar la solicitud.");
        }

        [HttpPost("reject")]
        public async Task<IActionResult> RejectFriendRequest([FromQuery] int amistadId)
        {
            if (!int.TryParse(User.Claims.FirstOrDefault(c => c.Type == "id")?.Value, out var receiverId))
                return Unauthorized("Usuario no autenticado.");

            var result = await _friendRequestService.RejectFriendRequest(amistadId, receiverId);
            return result ? Ok() : BadRequest("No se pudo rechazar la solicitud.");
        }


        [HttpGet("friends")]
        public async Task<ActionResult<List<Usuario>>> GetFriendsList()
        {
            if (!int.TryParse(User.Claims.FirstOrDefault(c => c.Type == "id")?.Value, out var usuarioId))
                return Unauthorized("Usuario no autenticado.");

            var amigos = await _friendRequestService.GetFriendsList(usuarioId);
            return Ok(amigos);
        }


        [HttpGet("pending")]
        public async Task<ActionResult<List<Amistad>>> GetPendingFriendRequests()
        {
            if (!int.TryParse(User.Claims.FirstOrDefault(c => c.Type == "id")?.Value, out var usuarioId))
                return Unauthorized("Usuario no autenticado.");

            var solicitudesPendientes = await _friendRequestService.GetPendingFriendRequests(usuarioId);
            return Ok(solicitudesPendientes);
        }

    }
}

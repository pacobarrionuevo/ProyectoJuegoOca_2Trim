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

            return result ? Ok() : StatusCode(500, "Error al enviar la solicitud.");
        }

        [HttpPost("accept")]
        public async Task<IActionResult> AcceptFriendRequest([FromQuery] int amistadId)
        {
            var result = await _friendRequestService.AcceptFriendRequest(amistadId);
            return result ? Ok() : BadRequest();
        }

        [HttpPost("reject")]
        public async Task<IActionResult> RejectFriendRequest([FromQuery] int amistadId)
        {
            var result = await _friendRequestService.RejectFriendRequest(amistadId);
            return result ? Ok() : BadRequest();
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

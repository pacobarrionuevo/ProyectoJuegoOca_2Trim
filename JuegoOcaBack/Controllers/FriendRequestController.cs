using JuegoOcaBack.Models.Database.Entidades;
using JuegoOcaBack.Services;
using Microsoft.AspNetCore.Mvc;

namespace JuegoOcaBack.Controllers
{
    [ApiController]
    [Route("api/friendship")]
    public class FriendshipController : ControllerBase
    {
        private readonly FriendRequestService _friendRequestService;

        public FriendshipController(FriendRequestService friendRequestService)
        {
            _friendRequestService = friendRequestService;
        }

        [HttpPost("send")]
        public async Task<IActionResult> SendFriendRequest([FromBody] dynamic request)
        {
            if (request == null || request.senderId == null || request.receiverId == null)
                return BadRequest("Los IDs del remitente y receptor son requeridos.");

            await _friendRequestService.AddFriendRequest((int)request.senderId, (int)request.receiverId);
            return Ok("Solicitud de amistad enviada.");
        }

        [HttpPost("accept")]
        public async Task<IActionResult> AcceptFriendRequest([FromBody] dynamic request)
        {
            if (request == null || request.senderId == null || request.receiverId == null)
                return BadRequest("Los IDs del remitente y receptor son requeridos.");

            await _friendRequestService.AcceptFriendRequest((int)request.senderId, (int)request.receiverId);
            return Ok("Solicitud de amistad aceptada.");
        }

        [HttpDelete("reject")]
        public async Task<IActionResult> RejectFriendRequest([FromBody] dynamic request)
        {
            if (request == null || request.senderId == null || request.receiverId == null)
                return BadRequest("Los IDs del remitente y receptor son requeridos.");

            await _friendRequestService.RejectFriendRequest((int)request.senderId, (int)request.receiverId);
            return Ok("Solicitud de amistad rechazada.");
        }

        [HttpGet("friends/{userId}")]
        public async Task<IActionResult> GetFriends(int userId)
        {
            var friends = await _friendRequestService.GetFriends(userId);
            return Ok(friends);
        }

        [HttpGet("pending/{userId}")]
        public async Task<IActionResult> GetPendingRequests(int userId)
        {
            var requests = await _friendRequestService.GetPendingRequests(userId);
            return Ok(requests);
        }
    }
}

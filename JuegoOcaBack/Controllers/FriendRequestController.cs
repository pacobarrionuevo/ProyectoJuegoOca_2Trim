using Microsoft.AspNetCore.Mvc;
using JuegoOcaBack.Services;
using System.Collections.Generic;
using System.Threading.Tasks;
using JuegoOcaBack.Models.Database.Entidades;

namespace JuegoOcaBack.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class FriendRequestController : ControllerBase
    {
        private readonly FriendRequestService _friendRequestService;

        public FriendRequestController(FriendRequestService friendRequestService)
        {
            _friendRequestService = friendRequestService;
        }

        [HttpPost("send")]
        public async Task<IActionResult> SendFriendRequest(int senderId, int receiverId)
        {
            var result = await _friendRequestService.SendFriendRequest(senderId, receiverId);
            if (result) return Ok();
            return BadRequest();
        }

        [HttpPost("accept")]
        public async Task<IActionResult> AcceptFriendRequest(int amistadId)
        {
            var result = await _friendRequestService.AcceptFriendRequest(amistadId);
            if (result) return Ok();
            return BadRequest();
        }

        [HttpPost("reject")]
        public async Task<IActionResult> RejectFriendRequest(int amistadId)
        {
            var result = await _friendRequestService.RejectFriendRequest(amistadId);
            if (result) return Ok();
            return BadRequest();
        }

        [HttpGet("friends/{usuarioId}")]
        public async Task<ActionResult<List<Usuario>>> GetFriendsList(int usuarioId)
        {
            var amigos = await _friendRequestService.GetFriendsList(usuarioId);
            return Ok(amigos);
        }

        [HttpGet("pending/{usuarioId}")]
        public async Task<ActionResult<List<Amistad>>> GetPendingFriendRequests(int usuarioId)
        {
            var solicitudesPendientes = await _friendRequestService.GetPendingFriendRequests(usuarioId);
            return Ok(solicitudesPendientes);
        }
    }
}
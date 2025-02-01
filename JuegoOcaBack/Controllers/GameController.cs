using JuegoOcaBack.Models.Database.Entidades;
using JuegoOcaBack.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace JuegoOcaBack.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class GameController : ControllerBase
    {
        private readonly GameService _gameService;

        public GameController(GameService gameService)
        {
            _gameService = gameService;
        }

        [HttpPost("add-player")]
        public IActionResult AgregarJugador( String name)
        {
            _gameService.AddPlayer(name);
            return Ok();
        }

        [HttpPost("move-player")]
        public IActionResult MoverJugador([FromBody] MovePlayerRequest request)
        {
            int newPosition = _gameService.MovePlayer(request.PlayerId, request.Dices);
            return Ok(new { NewPosition = newPosition });
        }

        [HttpGet("players")]
        public IActionResult ObtainPlayers()
        {
            var jugadores = _gameService.ObtainPlayers();
            return Ok(jugadores);
        }
    }
}

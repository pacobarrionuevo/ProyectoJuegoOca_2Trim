using JuegoOcaBack.Models.Database.Entidades;
using JuegoOcaBack.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using static GameService;

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
        public IActionResult AgregarJugador(String name)
        {
            _gameService.AddPlayer(name);
            return Ok();
        }

        [HttpPost("move-player")]
        public IActionResult MoverJugador([FromBody] MovePlayerRequest request)
        {
            int newPosition = _gameService.MovePlayer(request.PlayerId, request.Dices);

            var gameUpdateMessage = new
            {
                type = "gameUpdate",
                players = _gameService.ObtainPlayers(),
                currentPlayer = _gameService.CurrentPlayer,
                diceResult = request.Dices
            };
            // Enviar el mensaje a través del WebSocket

            _gameService.NextTurn();

            return Ok(new { NewPosition = newPosition });
        }

        [HttpGet("players")]
        public IActionResult ObtainPlayers()
        {
            var jugadores = _gameService.ObtainPlayers();
            return Ok(jugadores);
        }

        [HttpPost("start-game")]
        public IActionResult StartGame([FromBody] StartGameRequest request)
        {
            if (!Enum.TryParse<GameService.GameType>(request.GameType, out var gameType))
            {
                return BadRequest("Tipo de juego no válido");
            }

            _gameService.StartGame(
                gameId: request.GameId,
                playerName: request.PlayerName,
                gameType: gameType, // Ahora es el enum
                additionalPlayers: request.AdditionalPlayers
            );

            return Ok(new
            {
                Message = "Partida iniciada correctamente.",
                Players = _gameService.ObtainPlayers()
            });
        }

        public class StartGameRequest
        {
            public string GameId { get; set; }
            public string PlayerName { get; set; }
            public string GameType { get; set; } 
            public List<string> AdditionalPlayers { get; set; } = new List<string>();
        }
    }
}
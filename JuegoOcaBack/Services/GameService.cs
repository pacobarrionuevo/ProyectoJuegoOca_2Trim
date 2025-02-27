using JuegoOcaBack.Models.Database.Entidades;
using JuegoOcaBack.Models.DTO;
using Microsoft.EntityFrameworkCore.Metadata.Internal;
using System.Collections.Generic;
using System.Linq;

namespace JuegoOcaBack.Services
{
    public class GameService
    {
        private Board _board;
        private List<PlayerDTO> _players;
        private int _currentPlayerIndex = 0;

        public GameService()
        {
            _board = new Board();
            _players = new List<PlayerDTO>();
        }

        public PlayerDTO CurrentPlayer => _players[_currentPlayerIndex];

        /// <summary>
        /// Inicia una nueva partida.
        /// </summary>
        /// <param name="gameId">ID de la partida (opcional).</param>
        /// <param name="playerName">Nombre del jugador humano.</param>
        public void StartGame(string gameId, string playerName)
        {
            // Reiniciar el estado del juego
            _players.Clear();
            _currentPlayerIndex = 0;

            // Agregar al jugador humano
            AddPlayer(playerName);

            // Agregar al bot
            AddBot();

            // Inicializar el tablero (ya se hace en el constructor)
            Console.WriteLine($"Partida iniciada con ID: {gameId}");
            Console.WriteLine($"Jugadores: {string.Join(", ", _players.Select(p => p.Name))}");
        }

        public void AddPlayer(string name)
        {
            _players.Add(new PlayerDTO { Id = _players.Count + 1, Name = name, Position = 0 });
        }

        public void AddBot()
        {
            _players.Add(new PlayerDTO { Id = _players.Count + 1, Name = "Bot", Position = 0 });
        }

        public int MovePlayer(int playerId, int dices)
        {
            var player = _players.FirstOrDefault(p => p.Id == playerId);
            if (player == null) return -1;

            int newPosition = player.Position + dices;

            if (newPosition >= 63) // Ganó el juego
            {
                player.Position = 63;
                var gameOverMessage = new
                {
                    type = "gameOver",
                    winnerId = player.Id
                };
                // Enviar el mensaje a través del WebSocket
                return 63;
            }

            var cell = _board.Cells.FirstOrDefault(c => c.Number == newPosition);
            if (cell != null && cell.Type != "Normal")
            {
                newPosition = cell.Effect;
            }

            player.Position = newPosition;
            return newPosition;
        }

        public void NextTurn()
        {
            _currentPlayerIndex = (_currentPlayerIndex + 1) % _players.Count;
        }

        public void BotMove()
        {
            var bot = _players.FirstOrDefault(p => p.Name == "Bot");
            if (bot != null)
            {
                int diceResult = new Random().Next(1, 7);
                int newPosition = MovePlayer(bot.Id, diceResult);

                var moveMessage = new
                {
                    type = "gameUpdate",
                    players = _players,
                    currentPlayer = CurrentPlayer,
                    diceResult = diceResult
                };
                // Enviar el mensaje a través del WebSocket

                NextTurn();
            }
        }

        public List<PlayerDTO> ObtainPlayers()
        {
            return _players;
        }
    }
}
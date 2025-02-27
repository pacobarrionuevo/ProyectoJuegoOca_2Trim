using JuegoOcaBack.Models.Database.Entidades;
using JuegoOcaBack.Models.DTO;
using JuegoOcaBack.WebSocketAdvanced;
using Microsoft.EntityFrameworkCore.Metadata.Internal;
using Microsoft.Extensions.DependencyInjection;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;

namespace JuegoOcaBack.Services
{
    public class GameService
    {
        private Board _board;
        private List<PlayerDTO> _players;
        private int _currentPlayerIndex = 0;

        private readonly IServiceProvider _serviceProvider;

        public GameService(IServiceProvider serviceProvider)
        {
            _serviceProvider = serviceProvider;
            _board = new Board();
            _players = new List<PlayerDTO>();
        }

        private WebSocketNetwork GetWebSocketNetwork()
        {
            return _serviceProvider.GetRequiredService<WebSocketNetwork>();
        }

        public PlayerDTO CurrentPlayer => _players[_currentPlayerIndex];

        // Aquí se empieza la partida
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

        public void HandleMovePlayer(int playerId, int diceResult)
        {
            var webSocketNetwork = GetWebSocketNetwork();
            var player = _players.FirstOrDefault(p => p.Id == playerId);
            if (player == null) return;

            // Mover al jugador
            int newPosition = MovePlayer(playerId, diceResult);
            Console.WriteLine($"Moviendo al jugador {playerId} a la posición {newPosition}");

            // Notificar a los clientes sobre la actualización del estado del juego
            var moveMessage = new
            {
                type = "gameUpdate",
                players = _players, // Asegúrate de que esta lista esté actualizada
                currentPlayer = CurrentPlayer,
                diceResult = diceResult
            };

            // Enviar el mensaje a través del WebSocket
            var messageJson = JsonSerializer.Serialize(moveMessage);
            Console.WriteLine($"Enviando gameUpdate: {messageJson}");
            webSocketNetwork.BroadcastMessage(messageJson);
        }


        public void NextTurn()
        {
            _currentPlayerIndex = (_currentPlayerIndex + 1) % _players.Count;
        }

        public void PlayerMove(int playerId, int diceResult)
        {
            // Llamar a HandleMovePlayer para manejar el movimiento y la notificación
            HandleMovePlayer(playerId, diceResult);

            // Pasar al siguiente turno
            NextTurn();
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
using JuegoOcaBack.Models.Database.Entidades;
using JuegoOcaBack.Models.DTO;
using Microsoft.EntityFrameworkCore.Metadata.Internal;

namespace JuegoOcaBack.Services
{
    public class GameService
    {
        private Board _board;
        private List<PlayerDTO> _players;

        public GameService()
        {
            _board = new Board();
            _players = new List<PlayerDTO>();
        }

        public void AddPlayer(string name)
        {
            _players.Add(new PlayerDTO { Id = _players.Count + 1, Name = name, Position = 0 });
        }

        public int MovePlayer(int playerId, int dices)
        {
            var player = _players.FirstOrDefault(p => p.Id == playerId);
            if (player == null) return -1;

            int newPosition = player.Position + dices;

            if (newPosition >= 63) // Ganó el juego
            {
                player.Position = 63;
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

        public List<PlayerDTO> ObtainPlayers()
        {
            return _players;
        }
    }
}

using JuegoOcaBack.Models.Database.Entidades;
using JuegoOcaBack.Models.DTO;
using JuegoOcaBack.WebSocketAdvanced;
using System.Text.Json;

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

    private bool _gameStarted = false;

    public void StartGame(string gameId, string playerName)
    {
        // Reiniciar el estado del juego
        _players.Clear();
        _currentPlayerIndex = 0;

        // Agregar al jugador humano
        AddPlayer(playerName);

        // Agregar al bot
        AddBot();

        _gameStarted = true; // Marcar la partida como iniciada

        Console.WriteLine($"Partida iniciada con ID: {gameId}");
        Console.WriteLine($"Jugadores: {string.Join(", ", _players.Select(p => p.Name))}");
        Console.WriteLine($"Número de jugadores: {_players.Count}");
    }

    public bool IsGameStarted()
    {
        return _gameStarted;
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
                winnerId = player.Id,
                winnerName = player.Name
            };
            var messageJson = JsonSerializer.Serialize(gameOverMessage);
            GetWebSocketNetwork().BroadcastMessage(messageJson); // Notificar a todos los clientes
            return 63;
        }

        var cell = _board.Cells.FirstOrDefault(c => c.Number == newPosition);
        string cellType = cell?.Type ?? "Normal";
        string specialMessage = GetSpecialMessage(cellType);

        if (cell != null && cell.Type != "Normal")
        {
            newPosition = cell.Effect;
        }

        player.Position = newPosition;

        // Enviar mensaje de movimiento y casilla especial
        var moveMessage = new
        {
            type = "moveResult",
            playerId = player.Id,
            playerName = player.Name,
            diceResult = dices,
            newPosition = newPosition,
            cellType = cellType,
            specialMessage = specialMessage
        };
        var moveMessageJson = JsonSerializer.Serialize(moveMessage);
        GetWebSocketNetwork().BroadcastMessage(moveMessageJson);

        return newPosition;
    }

    private string GetSpecialMessage(string cellType)
    {
        switch (cellType)
        {
            case "Oca":
                return "De oca en oca y tiro porque me toca";
            case "Puente":
                return "De puente en puente y tiro porque me lleva la corriente";
            case "Posada":
                return "Descansas en la posada. Pierdes un turno.";
            case "Muerte":
                return "¡Has caído en la muerte! Vuelves al inicio.";
            case "Dados":
                return "Tira de nuevo por caer en los dados.";
            case "Laberinto":
                return "¡Estás en el laberinto! Retrocedes a la casilla 30.";
            case "Pozo":
                return "¡Has caído en el pozo! Pierdes dos turnos.";
            case "Carcel":
                return "¡Estás en la cárcel! Pierdes tres turnos.";
            default:
                return "";
        }
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
            players = _players,
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
        if (_players.Count == 0)
        {
            Console.WriteLine("Error: No hay jugadores en la partida.");
            return;
        }

        _currentPlayerIndex = (_currentPlayerIndex + 1) % _players.Count;
        Console.WriteLine($"Siguiente turno: Jugador actual es {CurrentPlayer.Name}");
    }

    public void PlayerMove(int playerId, int diceResult)
    {
        Console.WriteLine($"Intentando mover al jugador {playerId} con dado {diceResult}");

        var player = _players.FirstOrDefault(p => p.Id == playerId);
        if (player == null)
        {
            Console.WriteLine($"Error: Jugador con ID {playerId} no encontrado.");
            return;
        }

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
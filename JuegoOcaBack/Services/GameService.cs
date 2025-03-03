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
    public enum GameType { Bot, Multiplayer }
    private GameType _currentGameType;
    private string _currentGameId;
    private List<string> _rematchRequests = new List<string>();

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

    public void StartGame(string gameId, string playerName, GameType gameType, List<string> additionalPlayers = null)
    {
        // Validar si la partida ya está iniciada
        if (_gameStarted)
        {
            Console.WriteLine("La partida ya está en curso.");
            return;
        }

        _players.Clear();
        _currentPlayerIndex = 0;

        // Agregar jugador principal
        AddPlayer(playerName);

        // Agregar bot si el tipo de juego es Bot
        if (gameType == GameType.Bot)
        {
            AddBot();
        }
        // Agregar jugadores adicionales para multiplayer
        else if (gameType == GameType.Multiplayer && additionalPlayers != null)
        {
            foreach (var player in additionalPlayers)
            {
                AddPlayer(player);
            }
        }

        _gameStarted = true; // Marcar la partida como iniciada
        Console.WriteLine($"Partida iniciada con {_players.Count} jugadores:");
        foreach (var player in _players)
        {
            Console.WriteLine($"- {player.Name} (ID: {player.Id})");
        }
    }
    public bool IsGameStarted()
    {
        return _gameStarted;
    }

    public void AddPlayer(string name)
    {
        int newId = _players.Count > 0 ? _players.Max(p => p.Id) + 1 : 1;
        _players.Add(new PlayerDTO
        {
            Id = newId,
            Name = name,
            Position = 0,
            TurnsToSkip = 0
        }); 
    }

    public void AddBot()
    {
        int newId = _players.Count > 0 ? _players.Max(p => p.Id) + 1 : 1;
        _players.Add(new PlayerDTO
        {
            Id = newId,
            Name = "Bot",
            Position = 0,
            TurnsToSkip = 0
        });

        Console.WriteLine($"Bot añadido: Bot (ID: {newId})");
    }

    public int MovePlayer(int playerId, int dices)
    {
        var player = _players.FirstOrDefault(p => p.Id == playerId);
        if (player == null) return -1;

        // Si el jugador tiene turnos para perder, decrementa el contador y no mueve
        if (player.TurnsToSkip > 0)
        {
            player.TurnsToSkip--;
            var skipTurnMessage = new
            {
                type = "skipTurn",
                playerId = player.Id,
                playerName = player.Name,
                turnsToSkip = player.TurnsToSkip
            };
            var skipTurnMessageJson = JsonSerializer.Serialize(skipTurnMessage);
            GetWebSocketNetwork().BroadcastMessage(skipTurnMessageJson);
            return player.Position; // No se mueve, sigue en la misma posición
        }

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

            // Manejar efectos especiales de las casillas
            switch (cellType)
            {
                case "Oca":
                case "Puente":
                case "Dados":
                    // Repetir turno
                    player.TurnsToSkip = -1; // -1 indica que debe repetir turno
                    if (_currentGameType == GameType.Bot) NotifyBotTurn();
                    break;
                case "Posada":
                    // Pierde un turno
                    player.TurnsToSkip = 1;
                    break;
                case "Pozo":
                    // Pierde dos turnos
                    player.TurnsToSkip = 1;
                    break;
                case "Carcel":
                    // Pierde tres turnos
                    player.TurnsToSkip = 2;
                    break;
                case "Laberinto":
                    // Retrocede a la casilla 30
                    newPosition = 30;
                    break;
                case "Muerte":
                    // Vuelve al inicio
                    newPosition = 1;
                    break;
            }
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

        NotifyGameState();
        return newPosition;

    }
    private void NotifyGameState()
    {
        Console.WriteLine("\n--- ENVIANDO ESTADO ---");
        Console.WriteLine($"Jugadores en estado:");
        foreach (var player in _players)
        {
            Console.WriteLine($"- {player.Name} (ID: {player.Id}, Posición: {player.Position}, Saltos: {player.TurnsToSkip})");
        }
        Console.WriteLine($"Jugador actual: {CurrentPlayer.Name} (ID: {CurrentPlayer.Id})");

        var stateMessage = new
        {
            type = "gameUpdate",
            players = _players,
            currentPlayer = new
            {
                id = CurrentPlayer.Id,
                name = CurrentPlayer.Name,
                position = CurrentPlayer.Position,
                turnsToSkip = CurrentPlayer.TurnsToSkip
            },
            diceResult = (int?)null
        };

        GetWebSocketNetwork().BroadcastMessage(JsonSerializer.Serialize(stateMessage));
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
                return "De Dado a Dado y tiro porque me ha tocado";
            case "Laberinto":
                return "¡Estás en el laberinto! Retrocedes a la casilla 30.";
            case "Pozo":
                return "¡Has caído en el pozo! Pierdes un turno.";
            case "Carcel":
                return "¡Estás en la cárcel! Pierdes dos turnos.";
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
        if (_players.Count == 0) return;

        var currentPlayer = _players[_currentPlayerIndex];

        if (currentPlayer.TurnsToSkip == -1) // Repetir turno
        {
            Console.WriteLine("Turno repetido por efecto especial");
            currentPlayer.TurnsToSkip = 0;
            NotifyGameState();
            return;
        }
        else if (currentPlayer.TurnsToSkip > 0) // Saltar turno
        {
            Console.WriteLine($"Saltando turno. Turnos restantes: {currentPlayer.TurnsToSkip}");
            currentPlayer.TurnsToSkip--;
            _currentPlayerIndex = (_currentPlayerIndex + 1) % _players.Count;
            NotifyGameState();
            NextTurn(); // Llamada recursiva
            return;
        }

        // Cambiar al siguiente jugador
        _currentPlayerIndex = (_currentPlayerIndex + 1) % _players.Count;
        Console.WriteLine($"Nuevo turno: Jugador {_currentPlayerIndex} ({CurrentPlayer.Name}, ID: {CurrentPlayer.Id})");

        NotifyGameState();

        // Mover el bot automáticamente si es su turno
        if (_currentGameType == GameType.Bot && CurrentPlayer.Name == "Bot")
        {
            Console.WriteLine("Iniciando movimiento automático del bot");
            BotMove();
        }
    }
    private void NotifyBotTurn()
    {
        if (_currentGameType == GameType.Bot)
        {
            var botTurnMessage = new
            {
                type = "botTurn",
                gameId = _currentGameId
            };

            var messageJson = JsonSerializer.Serialize(botTurnMessage);
            GetWebSocketNetwork().BroadcastMessage(messageJson);
        }
    }
    public void HandleTurnTimeout(string gameId, int playerId)
    {
        var player = _players.FirstOrDefault(p => p.Id == playerId);
        if (player != null)
        {
            player.TurnsToSkip = 1;
            Console.WriteLine($"Tiempo agotado para {player.Name}");
            NextTurn();
        }
    }
    public void RestartGame(string gameId)
    {
        // Reiniciar posiciones y estados
        foreach (var player in _players)
        {
            player.Position = 0;
            player.TurnsToSkip = 0;
        }
        _currentPlayerIndex = 0;
        _gameStarted = true;

        Console.WriteLine($"Juego {gameId} reiniciado");
        NotifyGameState();
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
        if (_currentGameType != GameType.Bot || CurrentPlayer.Name != "Bot") return;

        var bot = _players.FirstOrDefault(p => p.Name == "Bot");
        if (bot != null)
        {
            int diceResult = new Random().Next(1, 7);
            int newPosition = MovePlayer(bot.Id, diceResult); // <- Esto actualiza la posición del bot

            // Notificar a los clientes
            var moveMessage = new
            {
                type = "botMove",
                playerId = bot.Id,
                diceResult = diceResult,
                newPosition = newPosition
            };
            var messageJson = JsonSerializer.Serialize(moveMessage);
            GetWebSocketNetwork().BroadcastMessage(messageJson);

            NextTurn(); // Pasar al siguiente turno
        }
    }
    public void HandlePlayerDisconnect(int playerId)
    {
        var player = _players.FirstOrDefault(p => p.Id == playerId);
        if (player != null)
        {
            if (_currentGameType == GameType.Multiplayer)
            {
                // Lógica específica para multiplayer
                _players.Remove(player);
                Console.WriteLine($"Jugador {player.Name} desconectado");

                if (_players.Count == 1)
                {
                    DeclareWinner(_players[0].Id);
                }
            }
            else
            {
                // En partidas con bot, terminar el juego
                DeclareWinner(_players.First(p => p.Name == "Bot").Id);
            }
        }
    }
    public void DeclareWinner(int winnerId) // Solo recibe winnerId
    {
        var winner = _players.FirstOrDefault(p => p.Id == winnerId);
        if (winner == null) return;

        var gameOverMessage = new
        {
            type = "gameOver",
            gameId = _currentGameId, // Usa la variable de instancia
            winnerId = winner.Id,
            winnerName = winner.Name
        };

        var messageJson = JsonSerializer.Serialize(gameOverMessage);
        GetWebSocketNetwork().BroadcastMessage(messageJson);

        _gameStarted = false;
    }
    public void HandleRematchRequest(string playerId)
    {
        if (!_rematchRequests.Contains(playerId))
        {
            _rematchRequests.Add(playerId);

            if (_rematchRequests.Count >= _players.Count)
            {
                StartRematch();
            }
        }
    }
    private void StartRematch()
    {
        Console.WriteLine($"Iniciando revancha para partida {_currentGameId}");

        // Resetear estado de jugadores
        foreach (var player in _players)
        {
            player.Position = 0;
            player.TurnsToSkip = 0;
        }

        _currentPlayerIndex = 0;
        _rematchRequests.Clear();

        NotifyGameState();

        var rematchMessage = new
        {

            type = "rematchStarted",
            gameId = _currentGameId
        };

        var messageJson = JsonSerializer.Serialize(rematchMessage);
        GetWebSocketNetwork().BroadcastMessage(messageJson);
    }
    public List<PlayerDTO> ObtainPlayers()
    {
        return _players;
    }
}
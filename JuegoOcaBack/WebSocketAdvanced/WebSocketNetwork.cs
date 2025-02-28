using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.WebSockets;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using JuegoOcaBack.Models.Database.Entidades;
using JuegoOcaBack.Models.Database;
using JuegoOcaBack.Models.DTO;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.AspNetCore.Mvc;
using JuegoOcaBack.Services;
using System.Text.Json.Serialization;

namespace JuegoOcaBack.WebSocketAdvanced
{
    public class WebSocketNetwork
    {
        private int _idCounter;
        // Lista de WebSocketHandler (clase que gestiona cada WebSocket)
        private readonly List<WebSocketHandler> _handlers = new List<WebSocketHandler>();

        private readonly List<WebSocketHandler> _connectedPlayers = new List<WebSocketHandler>();
        private readonly List<WebSocketHandler> _waitingPlayers = new List<WebSocketHandler>();

        // Semáforo para controlar el acceso a la lista de WebSocketHandler
        private readonly SemaphoreSlim _semaphore = new SemaphoreSlim(1, 1);

        private readonly SemaphoreSlim _connectedSemaphore = new SemaphoreSlim(1, 1);
        private readonly SemaphoreSlim _waitingSemaphore = new SemaphoreSlim(1, 1);

        private readonly IServiceProvider _serviceProvider;

        // Contador de conexiones activas
        private static int _activeConnections = 0;

        // Evento para notificar cambios en el número de conexiones
        public event Action<int> OnActiveConnectionsChanged;

        public WebSocketNetwork(IServiceProvider serviceProvider)
        {
            _serviceProvider = serviceProvider;
            OnActiveConnectionsChanged += count => NotifyActiveConnectionsChanged(count);
        }

        private GameService GetGameService()
        {
            return _serviceProvider.GetRequiredService<GameService>();
        }

        public async Task BroadcastMessage(string message)
        {
            await _semaphore.WaitAsync();
            try
            {
                var handlersSnapshot = _handlers.ToList(); // Crear una copia de la lista para evitar problemas de concurrencia
                foreach (var handler in handlersSnapshot)
                {
                    if (handler.IsOpen) // Verificar si el WebSocket está abierto
                    {
                        await handler.SendAsync(message); // Enviar el mensaje a cada cliente conectado
                    }
                }
            }
            finally
            {
                _semaphore.Release();
            }
        }

        private async void NotifyActiveConnectionsChanged(int count)
        {
            var message = new
            {
                Type = "activeConnections",
                Count = count
            };

            var handlersSnapshot = _handlers.ToList();
            foreach (var handler in handlersSnapshot)
            {
                if (handler.IsOpen)
                {
                    await handler.SendAsync(JsonSerializer.Serialize(message));
                }
            }
        }

        public async Task HandleAsync(WebSocket webSocket)
        {
            // Esta parte del código se encarga de 
            Interlocked.Increment(ref _activeConnections);
            OnActiveConnectionsChanged?.Invoke(_activeConnections);

            var handler = await CreateHandlerAsync(webSocket);
            await UpdateUserStatusAsync(handler, "Conectado");
            await NotifyFriendsAsync(handler, true);
            await handler.HandleAsync();
        }

        private async Task<WebSocketHandler> CreateHandlerAsync(WebSocket webSocket)
        {
            await _connectedSemaphore.WaitAsync();
            try
            {
                var handler = new WebSocketHandler(Interlocked.Increment(ref _idCounter), webSocket);
                handler.Disconnected += OnDisconnectedHandler;
                handler.MessageReceived += OnMessageReceivedHandler;
                _connectedPlayers.Add(handler);
                return handler;
            }
            finally
            {
                _connectedSemaphore.Release();
            }
        }

        private async Task OnDisconnectedHandler(WebSocketHandler handler)
        {
            await CleanupDisconnectedPlayer(handler);
            await UpdateUserStatusAsync(handler, "Desconectado");
            await NotifyFriendsAsync(handler, false);
        }

        private async Task CleanupDisconnectedPlayer(WebSocketHandler handler)
        {
            await _connectedSemaphore.WaitAsync();
            await _waitingSemaphore.WaitAsync();
            try
            {
                _connectedPlayers.Remove(handler);
                _waitingPlayers.Remove(handler);
            }
            finally
            {
                _connectedSemaphore.Release();
                _waitingSemaphore.Release();
            }
        }

        private async Task OnMessageReceivedHandler(WebSocketHandler handler, string message)
        {
            Console.WriteLine($"Mensaje recibido de {handler.Id}: {message}");

            try
            {
                // Deserializar el mensaje a la clase base para obtener el tipo
                var baseMessage = JsonSerializer.Deserialize<WebSocketMessage>(message);
                Console.WriteLine($"Tipo de mensaje: {baseMessage.Type}");

                switch (baseMessage.Type.ToLower()) // Convertir a minúsculas para evitar problemas
                {
                    case "moveplayer":
                        var movePlayerMessage = JsonSerializer.Deserialize<MovePlayerMessage>(message);
                        Console.WriteLine($"Moviendo al jugador {movePlayerMessage.PlayerId} con dado {movePlayerMessage.DiceResult}");
                        var gameService = GetGameService();
                        gameService.HandleMovePlayer(movePlayerMessage.PlayerId, movePlayerMessage.DiceResult);
                        break;

                    case "rolldice":
                        var rollDiceMessage = JsonSerializer.Deserialize<RollDiceMessage>(message);
                        Console.WriteLine($"Tirando dado para el jugador {rollDiceMessage.PlayerId}");
                        gameService = GetGameService();

                        // Verificar que la partida esté iniciada
                        if (!gameService.IsGameStarted())
                        {
                            Console.WriteLine("Error: La partida no ha sido iniciada.");
                            break;
                        }

                        // Verificar que haya jugadores
                        if (gameService.ObtainPlayers().Count == 0)
                        {
                            Console.WriteLine("Error: No hay jugadores en la partida.");
                            break;
                        }

                        int diceResult = new Random().Next(1, 7); // Generar un número aleatorio entre 1 y 6
                        gameService.PlayerMove(rollDiceMessage.PlayerId, diceResult);
                        break;

                    case "playrandom":
                        var playRandomMessage = JsonSerializer.Deserialize<PlayRandomMessage>(message);
                        await ProcessMatchmaking(handler);
                        break;

                    case "cancelsearch":
                        var cancelSearchMessage = JsonSerializer.Deserialize<CancelSearchMessage>(message);
                        await _waitingSemaphore.WaitAsync();
                        _waitingPlayers.RemoveAll(p => p.Id == handler.Id);
                        _waitingSemaphore.Release();
                        break;

                    default:
                        Console.WriteLine($"Tipo de mensaje no reconocido: {baseMessage.Type}");
                        break;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error procesando mensaje: {ex.Message}");
            }
        }
        public class WebSocketMessage
        {
            [JsonPropertyName("type")] // Asegúrate de que coincida con el JSON
            public string Type { get; set; }
        }

        public class RollDiceMessage : WebSocketMessage
        {
            [JsonPropertyName("playerId")] // Asegúrate de que coincida con el JSON
            public int PlayerId { get; set; }

            [JsonPropertyName("gameId")] // Asegúrate de que coincida con el JSON
            public string GameId { get; set; }
        }

        public class MovePlayerMessage : WebSocketMessage
        {
            [JsonPropertyName("playerId")] // Asegúrate de que coincida con el JSON
            public int PlayerId { get; set; }

            [JsonPropertyName("diceResult")] // Asegúrate de que coincida con el JSON
            public int DiceResult { get; set; }
        }

        public class PlayRandomMessage : WebSocketMessage
        {
            // Puedes agregar propiedades específicas para este tipo de mensaje si es necesario
        }

        public class CancelSearchMessage : WebSocketMessage
        {
            // Puedes agregar propiedades específicas para este tipo de mensaje si es necesario
        }

        private async Task ProcessMatchmaking(WebSocketHandler handler)
        {
            await _waitingSemaphore.WaitAsync();
            try
            {
                // Limpiar desconectados
                _waitingPlayers.RemoveAll(p => !p.IsOpen);

                // Agregar a la cola
                if (!_waitingPlayers.Any(p => p.Id == handler.Id))
                {
                    _waitingPlayers.Add(handler);
                }

                // Notificar a TODOS los jugadores en cola
                foreach (var player in _waitingPlayers.Where(p => p.IsOpen))
                {
                    await SendWaitingStatus(player);
                }

                // Emparejar
                if (_waitingPlayers.Count >= 2)
                {
                    var p1 = _waitingPlayers[0];
                    var p2 = _waitingPlayers[1];

                    if (p1.IsOpen && p2.IsOpen)
                    {
                        await CreateMatch(p1, p2);
                        _waitingPlayers.RemoveRange(0, 2);
                    }
                }
            }
            finally
            {
                _waitingSemaphore.Release();
            }
        }

        private async Task CreateMatch(WebSocketHandler p1, WebSocketHandler p2)
        {
            var roomId = Guid.NewGuid().ToString();

            var msg1 = new GameReadyMessage(
                type: "gameReady",
                gameId: roomId,
                opponentId: p2.Id
            );

            var msg2 = new GameReadyMessage(
                type: "gameReady",
                gameId: roomId,
                opponentId: p1.Id
            );

            await p1.SendAsync(JsonSerializer.Serialize(msg1));
            await p2.SendAsync(JsonSerializer.Serialize(msg2));
        }

        private async Task SendWaitingStatus(WebSocketHandler handler)
        {
            var statusMsg = new WaitlistMessage(
                type: "waitingStatus",
                playersInQueue: _waitingPlayers.Count,
                totalPlayers: _connectedPlayers.Count
            );

            await handler.SendAsync(JsonSerializer.Serialize(statusMsg));
        }

        private async Task UpdateUserStatusAsync(WebSocketHandler handler, string status)
        {
            using var scope = _serviceProvider.CreateScope();
            var wsMethods = scope.ServiceProvider.GetRequiredService<WebSocketMethods>();
            var user = await wsMethods.GetUserById(handler.Id);

            if (user != null)
            {
                user.UsuarioEstado = status;
                await wsMethods.UpdateUserAsync(user);
            }
        }

        private async Task NotifyFriendsAsync(WebSocketHandler handler, bool isConnected)
        {
            using var scope = _serviceProvider.CreateScope();
            var unitOfWork = scope.ServiceProvider.GetRequiredService<UnitOfWork>();
            var friends = await unitOfWork._friendRequestRepository.GetFriendsList(handler.Id);

            var message = JsonSerializer.Serialize(new
            {
                type = isConnected ? "friendConnected" : "friendDisconnected",
                friendId = handler.Id
            });

            foreach (var friend in _connectedPlayers.Where(p => friends.Any(f => f.UsuarioId == p.Id)))
            {
                await friend.SendAsync(message);
            }
        }

        private async Task NotifyUserConnectedAsync(WebSocketHandler WSHandler)
        {
            // Notificar a los amigos que el usuario está conectado
            using (var scope = _serviceProvider.CreateScope())
            {
                var unitOfWork = scope.ServiceProvider.GetRequiredService<UnitOfWork>();
                var wsMethods = scope.ServiceProvider.GetRequiredService<WebSocketMethods>();
                Usuario usuario = await wsMethods.GetUserById(WSHandler.Id);
                if (usuario != null)
                {
                    usuario.UsuarioEstado = "Conectado";
                    await wsMethods.UpdateUserAsync(usuario);
                }

                var amigos = await unitOfWork._friendRequestRepository.GetFriendsList(WSHandler.Id);

                foreach (WebSocketHandler handler in _handlers)
                {
                    if (amigos.Any(a => a.UsuarioId == handler.Id))
                    {
                        await handler.SendAsync(JsonSerializer.Serialize(new
                        {
                            Type = "friendConnected",
                            FriendId = WSHandler.Id
                        }));
                    }
                }
            }
        }

        private async Task OnDisconnectedAsync(WebSocketHandler disconnectedHandler)
        {
            // Decrementar el contador de conexiones activas
            Interlocked.Decrement(ref _activeConnections);
            OnActiveConnectionsChanged?.Invoke(_activeConnections);

            // Eliminar el WebSocketHandler de la lista
            await _semaphore.WaitAsync();
            disconnectedHandler.Disconnected -= OnDisconnectedAsync;
            // disconnectedHandler.MessageReceived -= OnMessageReceivedAsync;
            _handlers.Remove(disconnectedHandler);
            _semaphore.Release();

            // Notificar a los amigos que el usuario se ha desconectado
            using (var scope = _serviceProvider.CreateScope())
            {
                var unitOfWork = scope.ServiceProvider.GetRequiredService<UnitOfWork>();
                var wsMethods = scope.ServiceProvider.GetRequiredService<WebSocketMethods>();

                // Obtener el usuario y actualizar su estado a "Desconectado"
                Usuario usuario = await wsMethods.GetUserById(disconnectedHandler.Id);
                if (usuario != null)
                {
                    usuario.UsuarioEstado = "Desconectado";
                    await wsMethods.UpdateUserAsync(usuario);
                }

                var amigos = await unitOfWork._friendRequestRepository.GetFriendsList(disconnectedHandler.Id);

                foreach (WebSocketHandler handler in _handlers)
                {
                    if (amigos.Any(a => a.UsuarioId == handler.Id))
                    {
                        await handler.SendAsync(JsonSerializer.Serialize(new
                        {
                            Type = "friendDisconnected",
                            FriendId = disconnectedHandler.Id
                        }));
                    }
                }
            }
        }

        // Se utiliza en el DisconnectedAsync
        public WebSocketHandler GetHandlerById(int userId)
        {
            return _handlers.FirstOrDefault(h => h.Id == userId);
        }

        // Método para obtener el número de conexiones activas
        public int GetActiveConnections()   
        {
            return _activeConnections;
        }


    }

    // Records con propiedades en camelCase
    public record MatchmakingMessage(string type);
    public record GameReadyMessage(string type, string gameId, int opponentId);
    public record WaitlistMessage(string type, int playersInQueue, int totalPlayers);
}
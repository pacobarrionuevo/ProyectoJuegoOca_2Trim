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
        private readonly Dictionary<int, WebSocketHandler> _connectedUsers = new Dictionary<int, WebSocketHandler>();

        private readonly IServiceProvider _serviceProvider;

        // Contador de conexiones activas
        private static int _activeConnections = 0;

        // Evento para notificar cambios en el número de conexiones
        public event Action<int> OnActiveConnectionsChanged;

        public WebSocketNetwork(IServiceProvider serviceProvider)
        {
            _serviceProvider = serviceProvider;
            OnActiveConnectionsChanged += count => NotifyActiveConnectionsChanged(count);

            // Iniciar verificación de inactividad en segundo plano
            Task.Run(CheckInactiveConnections);
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
                Console.WriteLine($"Enviando mensaje a {handlersSnapshot.Count} clientes: {message}");
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
                Console.WriteLine($"Enviando mensaje a {handlersSnapshot.Count} clientes: {message}");
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
        private async Task CheckInactiveConnections()
        {
            while (true)
            {
                await Task.Delay(60000); // Verificar cada 60 segundos
                var now = DateTime.UtcNow;

                foreach (var userId in _connectedUsers.Keys.ToList())
                {
                    var handler = _connectedUsers[userId];
                    if ((now - handler.LastActivity).TotalMinutes > 1.5) // 1.5 minutos sin actividad
                    {
                        await RemoveUser(userId);
                        Console.WriteLine($"Usuario {userId} desconectado por inactividad.");
                    }
                }
            }
        }
        private async Task RemoveUser(int userId)
        {
            await _semaphore.WaitAsync();
            try
            {
                if (_connectedUsers.TryGetValue(userId, out var handler))
                {
                    await handler.CloseAsync();
                    _connectedUsers.Remove(userId);
                }
            }
            finally
            {
                _semaphore.Release();
            }
        }
        public async Task HandleAsync(WebSocket webSocket, int userId)
        {
            // Incrementar el contador de conexiones activas
            Interlocked.Increment(ref _activeConnections);
            OnActiveConnectionsChanged?.Invoke(_activeConnections);
            var handler = await CreateHandlerAsync(webSocket, userId);
            await AddUser(userId, handler);
            try
            {
                // Actualizar estado primero
                await UpdateUserStatusAsync(handler, "Conectado");
                await NotifyFriendsAsync(handler, true);

                // Iniciar heartbeat
                _ = StartHeartbeat(handler); // Nueva función

                await handler.HandleAsync();
            }
            finally
            {
                // Garantizar actualización al desconectar
                await UpdateUserStatusAsync(handler, "Desconectado");
                await NotifyFriendsAsync(handler, false);
                await CleanupDisconnectedPlayer(handler);
            }
        }
        private async Task AddUser(int userId, WebSocketHandler handler)
        {
            _connectedUsers[userId] = handler;
            Console.WriteLine($"Usuario {userId} conectado.");
        }
        private async Task StartHeartbeat(WebSocketHandler handler)
        {
            while (handler.IsOpen)
            {
                try
                {
                    await handler.SendAsync("ping");
                    await Task.Delay(30000); // Cada 30 segundos
                }
                catch
                {
                    await CleanupDisconnectedPlayer(handler);
                    break;
                }
            }
        }
        private async Task<WebSocketHandler> CreateHandlerAsync(WebSocket webSocket, int userId)
        {
            using var scope = _serviceProvider.CreateScope();
            var wsMethods = scope.ServiceProvider.GetRequiredService<WebSocketMethods>();
            var user = await wsMethods.GetUserById(userId);
            var handler = new WebSocketHandler(userId, webSocket, username: user?.UsuarioApodo ?? "Usuario desconocido"); // Asegúrate de que userId sea correcto
            await _semaphore.WaitAsync();
            try
            {
     
                handler.Disconnected -= OnDisconnectedHandler; // Eliminar suscripción previa (si existe)
                handler.Disconnected += OnDisconnectedHandler; // Suscribir el evento

                handler.MessageReceived += OnMessageReceivedHandler;
                _connectedUsers[userId] = handler;

                Console.WriteLine($"Usuario {userId} conectado y suscrito correctamente.");
                return handler;
            }
            finally
            {
                _semaphore.Release();
            }
        }
        private async Task OnDisconnectedHandler(WebSocketHandler handler)
        {
            Console.WriteLine($"Evento de desconexión disparado para el usuario {handler.Id}.");
            await CleanupDisconnectedPlayer(handler);
            await UpdateUserStatusAsync(handler, "Desconectado");
            await NotifyFriendsAsync(handler, false);
        }

        private async Task CleanupDisconnectedPlayer(WebSocketHandler handler)
        {
            await _semaphore.WaitAsync();
            await _connectedSemaphore.WaitAsync();
            await _waitingSemaphore.WaitAsync();
            try
            {
                // Verificar si el usuario ya fue eliminado
                if (!_connectedUsers.ContainsKey(handler.Id))
                {
                    Console.WriteLine($"Usuario {handler.Id} ya fue eliminado.");
                    return;
                }

                // Cerrar el WebSocket si está abierto
                if (handler.IsOpen)
                {
                    Console.WriteLine($"Cerrando WebSocket para el usuario {handler.Id}.");
                    await handler.CloseAsync();
                }

                // Eliminar de todas las listas
                _connectedPlayers.RemoveAll(p => p.Id == handler.Id);
                _waitingPlayers.RemoveAll(p => p.Id == handler.Id);
                _handlers.RemoveAll(p => p.Id == handler.Id);

                // Eliminar de _connectedUsers
                if (_connectedUsers.ContainsKey(handler.Id))
                {
                    _connectedUsers.Remove(handler.Id);
                    Console.WriteLine($"Usuario {handler.Id} eliminado de _connectedUsers.");
                }

                // Notificar cambio de estado
                await UpdateUserStatusAsync(handler, "Desconectado");
                await NotifyFriendsAsync(handler, false);

                Interlocked.Decrement(ref _activeConnections);
                OnActiveConnectionsChanged?.Invoke(_activeConnections);

                Console.WriteLine($"Usuario {handler.Id} limpiado correctamente.");
            }
            finally
            {
                _semaphore.Release();
                _connectedSemaphore.Release();
                _waitingSemaphore.Release();
            }
        }
        private async Task OnMessageReceivedHandler(WebSocketHandler handler, string message)
        {
            Console.WriteLine($"Mensaje recibido de {handler.Id}: {message}");
            if (message == "pong")
            {
                Console.WriteLine("Heartbeat recibido: pong");
                handler.LastActivity = DateTime.UtcNow; // Actualizar la última actividad
                return;
            }

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
                else if (msg.type == "sendFriendRequest")
                {
                    await ProcessFriendRequest(handler, msg.receiverId ?? 0);
                }
                else if (msg.type == "acceptFriendRequest")
                {
                    await ProcessAcceptFriendRequest(handler, msg.requestId ?? 0);
                }
                else if (msg.type == "rejectFriendRequest")
                {
                    await ProcessRejectFriendRequest(handler, msg.requestId ?? 0);
                }

            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error procesando mensaje: {ex.Message}");
                await CleanupDisconnectedPlayer(handler);
            }
        }
        private async Task ProcessInvitation(WebSocketHandler inviter, int friendId)
        {
            if (inviter.Id == friendId)
            {
                await inviter.SendAsync(JsonSerializer.Serialize(new
                {
                    type = "invalidInvitation",
                    message = "No puedes invitarte a ti mismo",
                    code = 400
                }));
                return;
            }
            _connectedUsers.TryGetValue(friendId, out var friend);

            if (friend == null || !friend.IsOpen)
            {
                await inviter.SendAsync(JsonSerializer.Serialize(new
                {
                    type = "friendNotAvailable",
                    message = "El amigo no está disponible."
                }));
                return;
            }
            // Obtener nombre del invitador
            using var scope = _serviceProvider.CreateScope();
            var wsMethods = scope.ServiceProvider.GetRequiredService<WebSocketMethods>();
            var inviterUser = await wsMethods.GetUserById(inviter.Id);
            string inviterName = inviterUser?.UsuarioApodo ?? "Jugador desconocido";

            // Enviar invitación al amigo
            await friend.SendAsync(JsonSerializer.Serialize(new
            {
                type = "friendInvitation", 
                fromUserId = inviter.Id,
                fromUserNickname = inviterName
            }));
        }
        private async Task ProcessRejectFriendRequest(WebSocketHandler handler, int requestId)
        {
            using var scope = _serviceProvider.CreateScope();
            var friendService = scope.ServiceProvider.GetRequiredService<FriendRequestService>();

            var requestDetails = await friendService.GetRequestDetails(requestId);
            if (requestDetails == null) return;

            var success = await friendService.RejectFriendRequest(requestId, handler.Id);

            if (success)
            {
                // Notificar al solicitante original
                if (_connectedUsers.TryGetValue(requestDetails.SenderId, out var sender))
                {
                    await sender.SendAsync(JsonSerializer.Serialize(new
                    {
                        type = "friendRequestRejected",
                        requestId = requestId,
                        reason = "La solicitud fue rechazada"
                    }));
                }
            }
        }
        private async Task ProcessFriendRequest(WebSocketHandler handler, int receiverId)
        {
            using var scope = _serviceProvider.CreateScope();
            var friendService = scope.ServiceProvider.GetRequiredService<FriendRequestService>();

            var result = await friendService.SendFriendRequest(handler.Id, receiverId);

            if (result.Success)
            {
                // Notificar al receptor
                if (_connectedUsers.TryGetValue(receiverId, out var receiver))
                {
                    await receiver.SendAsync(JsonSerializer.Serialize(new
                    {
                        type = "friendRequest",
                        requestId = result.AmistadId,
                        senderId = handler.Id,
                        senderName = result.SenderName
                    }));
                }
            }
        }

        private async Task ProcessAcceptFriendRequest(WebSocketHandler handler, int requestId)
        {
            using var scope = _serviceProvider.CreateScope();
            var friendService = scope.ServiceProvider.GetRequiredService<FriendRequestService>();

            var request = await friendService.GetRequestDetails(requestId);
            if (request == null) return;

            var success = await friendService.AcceptFriendRequest(requestId, handler.Id);

            if (success)
            {
                // Notificar a ambos usuarios
                var notifyPayload = new { type = "friendListUpdate" };

                // Al usuario que aceptó
                await handler.SendAsync(JsonSerializer.Serialize(notifyPayload));

                // Al solicitante original
                if (_connectedUsers.TryGetValue(request.SenderId, out var sender))
                {
                    await sender.SendAsync(JsonSerializer.Serialize(notifyPayload));
                }
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
        private async Task CreatePrivateGameRoom(WebSocketHandler acceptor, int inviterId)
        {
            _connectedUsers.TryGetValue(inviterId, out var inviter);

            if (inviter == null || !inviter.IsOpen)
            {
                await acceptor.SendAsync(JsonSerializer.Serialize(new
                {
                    type = "inviterNotAvailable",
                    message = "El invitador ya no está disponible."
                }));
                return;
            }

            // Crear sala privada
            var roomId = Guid.NewGuid().ToString();

            // Notificar a ambos jugadores
            await inviter.SendAsync(JsonSerializer.Serialize(new
            {
                type = "gameReady",
                gameId = roomId,
                opponentId = acceptor.Id
            }));

            await acceptor.SendAsync(JsonSerializer.Serialize(new
            {
                type = "gameReady",
                gameId = roomId,
                opponentId = inviter.Id
            }));

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
            try
            {
                var friends = await unitOfWork._friendRequestRepository.GetFriendsList(handler.Id);
                var message = new
                {
                    type = isConnected ? "friendConnected" : "friendDisconnected",
                    friendId = handler.Id
                };

                var serialized = JsonSerializer.Serialize(message);

                foreach (var friend in friends)
                {
                    var friendHandler = _connectedPlayers.FirstOrDefault(p => p.Id == friend.UsuarioId);
                    if (friendHandler?.IsOpen == true)
                    {
                        await friendHandler.SendAsync(serialized);
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error notificando amigos: {ex.Message}");
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
        public List<int> GetConnectedUsers()
        {
            return _connectedUsers.Keys.ToList();
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
    public record MatchmakingMessage(string type, int? friendId = null,
        int? inviterId = null, int? receiverId = null, 
    int? requestId = null);
    public record GameReadyMessage(string type, string gameId, int opponentId);
    public record WaitlistMessage(string type, int playersInQueue, int totalPlayers);
}

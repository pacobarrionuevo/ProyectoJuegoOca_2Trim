using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.WebSockets;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;
using JuegoOcaBack.Models.Database.Entidades;
using JuegoOcaBack.Models.Database;
using JuegoOcaBack.Models.DTO;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.AspNetCore.Mvc;
using JuegoOcaBack.Services;
using static JuegoOcaBack.WebSocketAdvanced.WebSocketNetwork;

namespace JuegoOcaBack.WebSocketAdvanced
{
    public class WebSocketNetwork
    {
        private int _idCounter;
        private readonly List<WebSocketHandler> _handlers = new List<WebSocketHandler>();
        private readonly List<WebSocketHandler> _connectedPlayers = new List<WebSocketHandler>();
        private readonly List<WebSocketHandler> _waitingPlayers = new List<WebSocketHandler>();

        private readonly SemaphoreSlim _semaphore = new SemaphoreSlim(1, 1);
        private readonly SemaphoreSlim _connectedSemaphore = new SemaphoreSlim(1, 1);
        private readonly SemaphoreSlim _waitingSemaphore = new SemaphoreSlim(1, 1);
        private readonly Dictionary<int, WebSocketHandler> _connectedUsers = new Dictionary<int, WebSocketHandler>();

        private readonly IServiceProvider _serviceProvider;
        private static int _activeConnections = 0;
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

        // (Opcional) Cerrar conexiones por inactividad
        private async Task CheckInactiveConnections()
        {
            while (true)
            {
                await Task.Delay(60000);
                var now = DateTime.UtcNow;
                foreach (var userId in _connectedUsers.Keys.ToList())
                {
                    var handler = _connectedUsers[userId];
                    if ((now - handler.LastActivity).TotalMinutes > 1.5)
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
            Interlocked.Increment(ref _activeConnections);
            OnActiveConnectionsChanged?.Invoke(_activeConnections);

            var handler = await CreateHandlerAsync(webSocket, userId);
            await AddUser(userId, handler);

            try
            {
                await UpdateUserStatusAsync(handler, "Conectado");
                await NotifyFriendsAsync(handler, true);

                await handler.HandleAsync();
            }
            finally
            {
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

        private async Task<WebSocketHandler> CreateHandlerAsync(WebSocket webSocket, int userId)
        {
            using var scope = _serviceProvider.CreateScope();
            var wsMethods = scope.ServiceProvider.GetRequiredService<WebSocketMethods>();
            var user = await wsMethods.GetUserById(userId);

            var handler = new WebSocketHandler(userId, webSocket, username: user?.UsuarioApodo ?? "Usuario desconocido");

            await _semaphore.WaitAsync();
            try
            {
                handler.Disconnected -= OnDisconnectedHandler;
                handler.Disconnected += OnDisconnectedHandler;
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
        private async Task CleanupDisconnectedPlayer(WebSocketHandler handler)
        {
            await _connectedSemaphore.WaitAsync();
            await _waitingSemaphore.WaitAsync();
            try
            {
                // Eliminar el handler de las listas
                _handlers.Remove(handler);
                _connectedPlayers.Remove(handler);
                _waitingPlayers.Remove(handler);

                Console.WriteLine($"Cliente desconectado. ID: {handler.Id}, Total de clientes: {_handlers.Count}");
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
                // Deserializar a un objeto base con la propiedad Type
                var baseMsg = JsonSerializer.Deserialize<WebSocketMessage>(message);
                if (baseMsg == null)
                {
                    Console.WriteLine("No se pudo deserializar el mensaje o es nulo.");
                    return;
                }

                switch (baseMsg.Type.ToLower())
                {
                    case "playrandom":
                        var playRandomMessage = JsonSerializer.Deserialize<PlayRandomMessage>(message);
                        await ProcessMatchmaking(handler);
                        break;

                    case "invitefriend":
                        var inviteFriendMessage = JsonSerializer.Deserialize<InviteFriendMessage>(message);
                        await ProcessInvitation(handler, inviteFriendMessage.FriendId);
                        break;

                    case "acceptinvitation":
                        var acceptInvitationMessage = JsonSerializer.Deserialize<AcceptInvitationMessage>(message);
                        await CreatePrivateGameRoom(handler, acceptInvitationMessage.InviterId);
                        break;

                    case "cancelsearch":
                        var cancelSearchMessage = JsonSerializer.Deserialize<CancelSearchMessage>(message);
                        await _waitingSemaphore.WaitAsync();
                        _waitingPlayers.RemoveAll(p => p.Id == handler.Id);
                        _waitingSemaphore.Release();
                        break;

                    case "chatmessage":
                        var chatMessage = JsonSerializer.Deserialize<ChatMessage>(message);
                        await BroadcastMessage(JsonSerializer.Serialize(new
                        {
                            Type = "chatMessage",
                            Sender = chatMessage.Sender,
                            Text = chatMessage.Text
                        }));
                        break;

                    case "sendfriendrequest":
                        var sendFriendRequestMessage = JsonSerializer.Deserialize<SendFriendRequestMessage>(message);
                        await ProcessFriendRequest(handler, sendFriendRequestMessage.ReceiverId);
                        break;

                    case "acceptfriendrequest":
                        var acceptFriendRequestMessage = JsonSerializer.Deserialize<AcceptFriendRequestMessage>(message);
                        await ProcessAcceptFriendRequest(handler, acceptFriendRequestMessage.RequestId);
                        break;

                    case "rejectfriendrequest":
                        var rejectFriendRequestMessage = JsonSerializer.Deserialize<RejectFriendRequestMessage>(message);
                        await ProcessRejectFriendRequest(handler, rejectFriendRequestMessage.RequestId);
                        break;

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

                        int diceResult = new Random().Next(1, 7);
                        gameService.PlayerMove(rollDiceMessage.PlayerId, diceResult);
                        break;

                    default:
                        Console.WriteLine($"Tipo de mensaje no reconocido: {baseMsg.Type}");
                        break;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error procesando mensaje: {ex.Message}");
                await CleanupDisconnectedPlayer(handler);
            }
        }

        public class ChatMessage : WebSocketMessage
        {
            [JsonPropertyName("sender")]
            public string Sender { get; set; }

            [JsonPropertyName("text")]
            public string Text { get; set; }
        }

        public class MatchmakingMessageDTO : WebSocketMessage
        {
            public string Type { get; set; } // Tipo de mensaje (inviteFriend, acceptInvitation, playWithBot, playRandom)
            public int FriendId { get; set; } // ID del amigo (para invitaciones)
            public int HostId { get; set; }
            public string RoomId { get; set; }
        }
        public class WebSocketMessage
        {
            [JsonPropertyName("type")] // Asegúrate de que coincida con el JSON
            public string Type { get; set; }
        }

        public class MovePlayerMessage : WebSocketMessage
        {
            [JsonPropertyName("playerId")] // Asegúrate de que coincida con el JSON
            public int PlayerId { get; set; }

            [JsonPropertyName("diceResult")] // Asegúrate de que coincida con el JSON
            public int DiceResult { get; set; }
        }

        public class PlayRandomMessage : WebSocketMessage { }

        public class CancelSearchMessage : WebSocketMessage { }

        public class InviteFriendMessage : WebSocketMessage
        {
            [JsonPropertyName("friendId")]
            public int FriendId { get; set; }
        }

        public class AcceptInvitationMessage : WebSocketMessage
        {
            [JsonPropertyName("inviterId")]
            public int InviterId { get; set; }
        }

        public class SendFriendRequestMessage : WebSocketMessage
        {
            [JsonPropertyName("receiverId")]
            public int ReceiverId { get; set; }
        }

        public class AcceptFriendRequestMessage : WebSocketMessage
        {
            [JsonPropertyName("requestId")]
            public int RequestId { get; set; }
        }

        public class RejectFriendRequestMessage : WebSocketMessage
        {
            [JsonPropertyName("requestId")]
            public int RequestId { get; set; }
        }


        // Clases con propiedades opcionales para evitar problemas de herencia y constructores
       

        public class GameReadyMessage
        {
            [JsonPropertyName("type")]
            public string Type { get; set; }
            [JsonPropertyName("gameId")]
            public string GameId { get; set; }
            [JsonPropertyName("opponentId")]
            public int OpponentId { get; set; }
        }

        public class WaitlistMessage
        {
            [JsonPropertyName("type")]
            public string Type { get; set; }
            [JsonPropertyName("playersInQueue")]
            public int PlayersInQueue { get; set; }
            [JsonPropertyName("totalPlayers")]
            public int TotalPlayers { get; set; }
        }

        public class RollDiceMessage : WebSocketMessage
        {
            [JsonPropertyName("playerId")] // Asegúrate de que coincida con el JSON
            public int PlayerId { get; set; }

            [JsonPropertyName("gameId")] // Asegúrate de que coincida con el JSON
            public string GameId { get; set; }
        }

        private async Task ProcessMatchmaking(WebSocketHandler handler)
        {
            await _waitingSemaphore.WaitAsync();
            try
            {
                _waitingPlayers.RemoveAll(p => !p.IsOpen);

                if (!_waitingPlayers.Any(p => p.Id == handler.Id))
                {
                    _waitingPlayers.Add(handler);
                }

                foreach (var player in _waitingPlayers.Where(p => p.IsOpen))
                {
                    await SendWaitingStatus(player);
                }

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

            var msg1 = new GameReadyMessage
            {
                Type = "gameReady",
                GameId = roomId,
                OpponentId = p2.Id
            };

            var msg2 = new GameReadyMessage
            {
                Type = "gameReady",
                GameId = roomId,
                OpponentId = p1.Id
            };

            await p1.SendAsync(JsonSerializer.Serialize(msg1));
            await p2.SendAsync(JsonSerializer.Serialize(msg2));
        }

        private async Task SendWaitingStatus(WebSocketHandler handler)
        {
            var statusMsg = new WaitlistMessage
            {
                Type = "waitingStatus",
                PlayersInQueue = _waitingPlayers.Count,
                TotalPlayers = _connectedPlayers.Count
            };

            await handler.SendAsync(JsonSerializer.Serialize(statusMsg));
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

            var roomId = Guid.NewGuid().ToString();

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

        private async Task ProcessFriendRequest(WebSocketHandler handler, int receiverId)
        {
            using var scope = _serviceProvider.CreateScope();
            var friendService = scope.ServiceProvider.GetRequiredService<FriendRequestService>();

            var result = await friendService.SendFriendRequest(handler.Id, receiverId);

            if (result.Success)
            {
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
                var notifyPayload = new { type = "friendListUpdate" };
                await handler.SendAsync(JsonSerializer.Serialize(notifyPayload));

                if (_connectedUsers.TryGetValue(request.SenderId, out var sender))
                {
                    await sender.SendAsync(JsonSerializer.Serialize(notifyPayload));
                }
            }
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

            // Notificar solo a _connectedPlayers que sean amigos
            foreach (var friend in _connectedPlayers.Where(p => friends.Any(f => f.UsuarioId == p.Id)))
            {
                await friend.SendAsync(message);
            }
        }

        public List<int> GetConnectedUsers() => _connectedUsers.Keys.ToList();

        public int GetActiveConnections() => _activeConnections;

        // Se utiliza en el DisconnectedAsync (puedes usarlo si quieres)
        public WebSocketHandler GetHandlerById(int userId)
        {
            return _handlers.FirstOrDefault(h => h.Id == userId);
        }
    }

    public class MatchmakingMessage
    {
        [JsonPropertyName("type")]
        public string Type { get; set; }

        [JsonPropertyName("friendId")]
        public int? FriendId { get; set; }

        [JsonPropertyName("inviterId")]
        public int? InviterId { get; set; }

        [JsonPropertyName("receiverId")]
        public int? ReceiverId { get; set; }

        [JsonPropertyName("requestId")]
        public int? RequestId { get; set; }
    }

}

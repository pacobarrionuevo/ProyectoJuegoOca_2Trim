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

namespace JuegoOcaBack.WebSocketAdvanced
{
    public class WebSocketNetwork
    {
        private int _idCounter;
        private readonly List<WebSocketHandler> _connectedPlayers = new List<WebSocketHandler>();
        private readonly List<WebSocketHandler> _waitingPlayers = new List<WebSocketHandler>();
        private readonly SemaphoreSlim _connectedSemaphore = new SemaphoreSlim(1, 1);
        private readonly SemaphoreSlim _waitingSemaphore = new SemaphoreSlim(1, 1);
        private readonly IServiceProvider _serviceProvider;

        public WebSocketNetwork(IServiceProvider serviceProvider)
        {
            _serviceProvider = serviceProvider;
        }

        public async Task HandleAsync(WebSocket webSocket)
        {
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
                var msg = JsonSerializer.Deserialize<MatchmakingMessage>(message);

                if (msg?.type == "playRandom")
                {
                    await ProcessMatchmaking(handler);
                }
                else if (msg?.type == "cancelSearch")
                {
                    await _waitingSemaphore.WaitAsync();
                    _waitingPlayers.RemoveAll(p => p.Id == handler.Id);
                    _waitingSemaphore.Release();
                }
                else if (msg?.type == "inviteFriend")
                {
                    await ProcessInvitation(handler, msg.friendId?? 0);
                }
                else if (msg?.type == "acceptInvitation")
                {
                    await CreateGameRoom(handler, msg.inviterId ?? 0);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error procesando mensaje: {ex.Message}");
            }
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

        private async Task ProcessInvitation(WebSocketHandler inviter, int friendId)
        {
            var friend = _connectedPlayers.FirstOrDefault(p => p.Id == friendId);
            if (friend == null || !friend.IsOpen)
            {
                await inviter.SendAsync(JsonSerializer.Serialize(new
                {
                    type = "friendNotAvailable",
                    message = "El amigo no está disponible."
                }));
                return;
            }

            // Enviar invitación al amigo
            await friend.SendAsync(JsonSerializer.Serialize(new
            {
                type = "invitationReceived",
                inviterId = inviter.Id,
                inviterName = "Nombre del Invitador" // Puedes obtenerlo de la base de datos
            }));
        }

        private async Task CreateGameRoom(WebSocketHandler acceptor, int inviterId)
        {
            var inviter = _connectedPlayers.FirstOrDefault(p => p.Id == inviterId);
            if (inviter == null || !inviter.IsOpen)
            {
                await acceptor.SendAsync(JsonSerializer.Serialize(new
                {
                    type = "inviterNotAvailable",
                    message = "El invitador ya no está disponible."
                }));
                return;
            }

            // Crear sala de juego
            var roomId = Guid.NewGuid().ToString();

            // Notificar a ambos jugadores
            await inviter.SendAsync(JsonSerializer.Serialize(new
            {
                type = "invitationAccepted",
                gameId = roomId,
                opponentId = acceptor.Id
            }));

            await acceptor.SendAsync(JsonSerializer.Serialize(new
            {
                type = "invitationAccepted",
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
    }

    // Records con propiedades en camelCase
    public record MatchmakingMessage(string type, int? friendId = null, int? inviterId = null);
    public record GameReadyMessage(string type, string gameId, int opponentId);
    public record WaitlistMessage(string type, int playersInQueue, int totalPlayers);
}
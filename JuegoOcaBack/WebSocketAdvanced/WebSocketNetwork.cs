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
            await _semaphore.WaitAsync();
            await _connectedSemaphore.WaitAsync();
            await _waitingSemaphore.WaitAsync();
            try
            {
                // Eliminar de todas las listas
                _connectedPlayers.RemoveAll(p => p.Id == handler.Id);
                _waitingPlayers.RemoveAll(p => p.Id == handler.Id);
                _handlers.RemoveAll(p => p.Id == handler.Id);
                // Notificar cambio de estado
                await UpdateUserStatusAsync(handler, "Desconectado");
                await NotifyFriendsAsync(handler, false);
                Interlocked.Decrement(ref _activeConnections);
                OnActiveConnectionsChanged?.Invoke(_activeConnections);
            }
            finally
            {
                _semaphore.Release();
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
                else if (msg?.type == "inviteFriend")
                {
                    await ProcessInvitation(handler, msg.friendId ?? 0);
                }
                else if (msg?.type == "acceptInvitation")
                {
                    await CreatePrivateGameRoom(handler, msg.inviterId ?? 0);
                }
                else if (msg?.type == "cancelSearch")
                {
                    await _waitingSemaphore.WaitAsync();
                    _waitingPlayers.RemoveAll(p => p.Id == handler.Id);
                    _waitingSemaphore.Release();
                }
                else if (message == "pong")
                {
                    handler.LastActivity = DateTime.UtcNow; // Nueva propiedad en WebSocketHandler
                    return;
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
            // Obtener nombre del invitador
            using var scope = _serviceProvider.CreateScope();
                var wsMethods = scope.ServiceProvider.GetRequiredService<WebSocketMethods>();
                var inviterUser = await wsMethods.GetUserById(inviter.Id);
                string inviterName = inviterUser?.UsuarioApodo ?? "Jugador desconocido";

                // Enviar invitación al amigo
                await friend.SendAsync(JsonSerializer.Serialize(new
                {
                    type = "invitationReceived",
                    inviterId = inviter.Id,
                    inviterName = inviterName
                }));
            
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
        int? inviterId = null);
    public record GameReadyMessage(string type, string gameId, int opponentId);
    public record WaitlistMessage(string type, int playersInQueue, int totalPlayers);
}
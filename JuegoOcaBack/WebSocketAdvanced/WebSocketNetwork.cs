using JuegoOcaBack.Models.Database.Entidades;
using JuegoOcaBack.Models.Database;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.WebSockets;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using JuegoOcaBack.Models.DTO;
using Microsoft.Extensions.DependencyInjection;

namespace JuegoOcaBack.WebSocketAdvanced
{
    public class WebSocketNetwork
    {
        private static int _idCounter = 0;
        private readonly List<WebSocketHandler> _handlers = new List<WebSocketHandler>();
        private readonly List<WebSocketHandler> _waitingUsers = new List<WebSocketHandler>();
        private readonly Dictionary<string, List<WebSocketHandler>> _rooms = new Dictionary<string, List<WebSocketHandler>>();
        private readonly SemaphoreSlim _semaphore = new SemaphoreSlim(1, 1);
        private readonly IServiceProvider _serviceProvider;

        public WebSocketNetwork(IServiceProvider serviceProvider)
        {
            _serviceProvider = serviceProvider;
        }

        public async Task HandleAsync(WebSocket webSocket)
        {
            WebSocketHandler handler = await AddWebsocketAsync(webSocket);
            await NotifyUserConnectedAsync(handler);
            await handler.HandleAsync();
        }

        private async Task<WebSocketHandler> AddWebsocketAsync(WebSocket webSocket)
        {
            await _semaphore.WaitAsync();
            try
            {
                WebSocketHandler handler = new WebSocketHandler(_idCounter, webSocket);
                handler.Disconnected += OnDisconnectedAsync;
                handler.MessageReceived += OnMessageReceivedAsync;
                _handlers.Add(handler);

                _idCounter++;
                return handler;
            }
            finally
            {
                _semaphore.Release();
            }
        }

        private async Task NotifyUserConnectedAsync(WebSocketHandler WSHandler)
        {
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
            await _semaphore.WaitAsync();
            try
            {
                disconnectedHandler.Disconnected -= OnDisconnectedAsync;
                disconnectedHandler.MessageReceived -= OnMessageReceivedAsync;
                _handlers.Remove(disconnectedHandler);
                _waitingUsers.Remove(disconnectedHandler);
            }
            finally
            {
                _semaphore.Release();
            }

            using (var scope = _serviceProvider.CreateScope())
            {
                var unitOfWork = scope.ServiceProvider.GetRequiredService<UnitOfWork>();
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

        private async Task OnMessageReceivedAsync(WebSocketHandler userHandler, string message)
        {
            Console.WriteLine($"Mensaje recibido: {message}");
            try
            {
                var messageObject = JsonSerializer.Deserialize<MatchmakingMessageDTO>(message);

                if (messageObject.Type == "playRandom")
                {
                    Console.WriteLine($"Usuario {userHandler.Id} busca partida aleatoria.");
                    _waitingUsers.Add(userHandler);

                    if (_waitingUsers.Count >= 2)
                    {
                        Console.WriteLine($"Emparejando a {_waitingUsers[0].Id} y {_waitingUsers[1].Id}.");
                        var player1 = _waitingUsers[0];
                        var player2 = _waitingUsers[1];

                        if (player1.IsOpen && player2.IsOpen)
                        {
                            var roomId = Guid.NewGuid().ToString();
                            _rooms[roomId] = new List<WebSocketHandler> { player1, player2 };

                            Console.WriteLine($"Sala creada con ID: {roomId}. Jugadores: {player1.Id}, {player2.Id}");

                            await player1.SendAsync(JsonSerializer.Serialize(new
                            {
                                Type = "gameReady",
                                GameId = roomId,
                                Opponent = player2.Id
                            }));

                            await player2.SendAsync(JsonSerializer.Serialize(new
                            {
                                Type = "gameReady",
                                GameId = roomId,
                                Opponent = player1.Id
                            }));

                            _waitingUsers.Remove(player1);
                            _waitingUsers.Remove(player2);
                        }
                        else
                        {
                            if (!player1.IsOpen)
                            {
                                Console.WriteLine($"Jugador {player1.Id} no está conectado. Eliminando de la lista de espera.");
                                _waitingUsers.Remove(player1);
                            }

                            if (!player2.IsOpen)
                            {
                                Console.WriteLine($"Jugador {player2.Id} no está conectado. Eliminando de la lista de espera.");
                                _waitingUsers.Remove(player2);
                            }

                            await userHandler.SendAsync(JsonSerializer.Serialize(new
                            {
                                Type = "waitingForOpponent"
                            }));
                        }
                    }
                    else
                    {
                        Console.WriteLine($"Usuario {userHandler.Id} en espera de oponente.");
                        await userHandler.SendAsync(JsonSerializer.Serialize(new
                        {
                            Type = "waitingForOpponent"
                        }));
                    }
                }
                else if (messageObject.Type == "playWithBot")
                {
                    var roomId = Guid.NewGuid().ToString();
                    _rooms[roomId] = new List<WebSocketHandler> { userHandler };

                    await userHandler.SendAsync(JsonSerializer.Serialize(new
                    {
                        Type = "gameReady",
                        GameId = roomId,
                        Opponent = "Bot"
                    }));
                }
                else if (messageObject.Type == "inviteFriend")
                {
                    Console.WriteLine($"Invitación enviada a: {messageObject.FriendId}");
                    int friendId = messageObject.FriendId;
                    var friendHandler = _handlers.FirstOrDefault(h => h.Id == friendId);

                    if (friendHandler != null && friendHandler.IsOpen)
                    {
                        var roomId = Guid.NewGuid().ToString();
                        _rooms[roomId] = new List<WebSocketHandler> { userHandler, friendHandler };

                        await friendHandler.SendAsync(JsonSerializer.Serialize(new
                        {
                            Type = "friendInvitation",
                            FromUserId = userHandler.Id,
                            FromUserNickname = "Nombre del anfitrión",
                            RoomId = roomId
                        }));
                    }
                    else
                    {
                        await userHandler.SendAsync(JsonSerializer.Serialize(new
                        {
                            Type = "error",
                            Message = "El amigo no está conectado."
                        }));
                    }
                }
                else if (messageObject.Type == "acceptInvitation")
                {
                    string roomId = messageObject.RoomId;
                    if (_rooms.ContainsKey(roomId))
                    {
                        var players = _rooms[roomId];
                        if (players.Count == 2 && players.All(p => p.IsOpen))
                        {
                            await players[1].SendAsync(JsonSerializer.Serialize(new
                            {
                                Type = "gameReady",
                                GameId = roomId,
                                Opponent = players[0].Id
                            }));

                            await players[0].SendAsync(JsonSerializer.Serialize(new
                            {
                                Type = "gameReady",
                                GameId = roomId,
                                Opponent = players[1].Id
                            }));
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error al procesar el mensaje: {ex.Message}");
            }
        }
    }
}
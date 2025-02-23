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
namespace JuegoOcaBack.WebSocketAdvanced
{
    public class WebSocketNetwork
    {
        // Contador para asignar un ID único a cada WebSocketHandler
        private static int _idCounter = 0;

        // Lista de WebSocketHandler (clase que gestiona cada WebSocket)
        private readonly List<WebSocketHandler> _handlers = new List<WebSocketHandler>();

        // Lista de usuarios en espera para matchmaking aleatorio
        private readonly List<WebSocketHandler> _waitingUsers = new List<WebSocketHandler>();

        // Diccionario para manejar salas de espera (key: roomId, value: lista de jugadores)
        private readonly Dictionary<string, List<WebSocketHandler>> _rooms = new Dictionary<string, List<WebSocketHandler>>();

        // Semáforo para controlar el acceso a la lista de WebSocketHandler
        private readonly SemaphoreSlim _semaphore = new SemaphoreSlim(1, 1);

        private readonly IServiceProvider _serviceProvider;

        public WebSocketNetwork(IServiceProvider serviceProvider)
        {
            _serviceProvider = serviceProvider;
        }

        public async Task HandleAsync(WebSocket webSocket)
        {
            // Crear un nuevo WebSocketHandler y agregarlo a la lista
            WebSocketHandler handler = await AddWebsocketAsync(webSocket);

            // Notificar a los usuarios que un nuevo usuario se ha conectado
            await NotifyUserConnectedAsync(handler);

            // Esperar a que el WebSocketHandler termine de manejar la conexión
            await handler.HandleAsync();
        }

        private async Task<WebSocketHandler> AddWebsocketAsync(WebSocket webSocket)
        {
            // Esperar a que haya un hueco disponible
            await _semaphore.WaitAsync();

            // Crear un nuevo WebSocketHandler
            WebSocketHandler handler = new WebSocketHandler(_idCounter, webSocket);
            handler.Disconnected += OnDisconnectedAsync;
            handler.MessageReceived += OnMessageReceivedAsync;
            _handlers.Add(handler);

            // Incrementar el contador para el siguiente
            _idCounter++;

            // Liberar el semáforo
            _semaphore.Release();

            return handler;
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

        // comprobar funcionamiento
        private async Task OnDisconnectedAsync(WebSocketHandler disconnectedHandler)
        {
            // Eliminar el WebSocketHandler de la lista
            await _semaphore.WaitAsync();
            disconnectedHandler.Disconnected -= OnDisconnectedAsync;
            disconnectedHandler.MessageReceived -= OnMessageReceivedAsync;
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

        public async Task RemoveHandlerAsync(WebSocketHandler disconnectedHandler)
        {
            await _semaphore.WaitAsync();
            disconnectedHandler.Disconnected -= OnDisconnectedAsync;
            disconnectedHandler.MessageReceived -= OnMessageReceivedAsync;
            _handlers.Remove(disconnectedHandler);
            _semaphore.Release();

            // Notificar a los amigos que el usuario se ha desconectado
            using (var scope = _serviceProvider.CreateScope())
            {
                var unitOfWork = scope.ServiceProvider.GetRequiredService<UnitOfWork>();
                var wsMethods = scope.ServiceProvider.GetRequiredService<WebSocketMethods>();

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



        private async Task OnMessageReceivedAsync(WebSocketHandler userHandler, string message)
        {
            try
            {
                var messageObject = JsonSerializer.Deserialize<MatchmakingMessageDTO>(message);

                if (messageObject.Type == "playRandom")
                {
                    // Buscar un oponente aleatorio
                    _waitingUsers.Add(userHandler);

                    if (_waitingUsers.Count >= 2)
                    {
                        // Emparejar a los dos primeros usuarios en la lista
                        var player1 = _waitingUsers[0];
                        var player2 = _waitingUsers[1];

                        // Crear una sala de espera
                        var roomId = Guid.NewGuid().ToString();
                        _rooms[roomId] = new List<WebSocketHandler> { player1, player2 };

                        // Notificar a ambos usuarios que la partida ha comenzado
                        var gameResponse = new
                        {
                            Type = "gameReady",
                            GameId = roomId,
                            Opponent = player2.Id // ID del oponente
                        };
                        await player1.SendAsync(JsonSerializer.Serialize(gameResponse));

                        var gameResponse2 = new
                        {
                            Type = "gameReady",
                            GameId = roomId,
                            Opponent = player1.Id // ID del oponente
                        };
                        await player2.SendAsync(JsonSerializer.Serialize(gameResponse2));

                        // Eliminar a los usuarios de la lista de espera
                        _waitingUsers.Remove(player1);
                        _waitingUsers.Remove(player2);
                    }
                    else
                    {
                        // Notificar al usuario que está en espera
                        await userHandler.SendAsync(JsonSerializer.Serialize(new
                        {
                            Type = "waitingForOpponent"
                        }));
                    }
                }
                else if (messageObject.Type == "playWithBot")
                {
                    // Iniciar partida con un bot
                    var roomId = Guid.NewGuid().ToString();
                    _rooms[roomId] = new List<WebSocketHandler> { userHandler };

                    // Notificar al usuario que la partida ha comenzado
                    var botResponse = new
                    {
                        Type = "gameReady",
                        GameId = roomId,
                        Opponent = "Bot" // Indicar que el oponente es un bot
                    };
                    await userHandler.SendAsync(JsonSerializer.Serialize(botResponse));
                }
                else if (messageObject.Type == "inviteFriend")
                {
                    // Invitar a un amigo a jugar
                    int friendId = messageObject.FriendId;
                    var friendHandler = _handlers.FirstOrDefault(h => h.Id == friendId);

                    if (friendHandler != null && friendHandler.IsOpen)
                    {
                        // Crear una sala de espera
                        var roomId = Guid.NewGuid().ToString();
                        _rooms[roomId] = new List<WebSocketHandler> { userHandler, friendHandler };

                        // Notificar al amigo que ha sido invitado
                        var inviteMessage = new
                        {
                            Type = "friendInvitation",
                            FromUserId = userHandler.Id,
                            FromUserNickname = "Nombre del anfitrión",
                            RoomId = roomId
                        };
                        await friendHandler.SendAsync(JsonSerializer.Serialize(inviteMessage));
                    }
                    else
                    {
                        // Notificar al usuario que el amigo no está conectado
                        await userHandler.SendAsync(JsonSerializer.Serialize(new
                        {
                            Type = "error",
                            Message = "El amigo no está conectado."
                        }));
                    }
                }
                else if (messageObject.Type == "acceptInvitation")
                {
                    // Aceptar una invitación de amigo
                    string roomId = messageObject.RoomId;
                    if (_rooms.ContainsKey(roomId))
                    {
                        var players = _rooms[roomId];
                        if (players.Count == 2)
                        {
                            // Notificar a ambos usuarios que la partida ha comenzado
                            var gameResponse = new
                            {
                                Type = "gameReady",
                                GameId = roomId,
                                Opponent = players[0].Id // ID del oponente
                            };
                            await players[1].SendAsync(JsonSerializer.Serialize(gameResponse));

                            var gameResponse2 = new
                            {
                                Type = "gameReady",
                                GameId = roomId,
                                Opponent = players[1].Id // ID del oponente
                            };
                            await players[0].SendAsync(JsonSerializer.Serialize(gameResponse2));
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
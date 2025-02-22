using System.Net.WebSockets;
using System.Text.Json;
using JuegoOcaBack.Models.Database;
using JuegoOcaBack.Models.Database.Entidades;
using JuegoOcaBack.Models.DTO;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using System.Threading;

namespace JuegoOcaBack.WebSocketAdvanced
{
    public class WebSocketNetwork
    {
        private static int _idCounter = 0;
        private readonly List<WebSocketHandler> _handlers = new List<WebSocketHandler>();
        private readonly SemaphoreSlim _semaphore = new SemaphoreSlim(1, 1);
        private readonly IServiceProvider _serviceProvider;
        private readonly List<WebSocketHandler> _waitingUsers = new List<WebSocketHandler>();
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
            WebSocketHandler handler = new WebSocketHandler(_idCounter, webSocket);
            handler.Disconnected += OnDisconnectedAsync;
            handler.MessageReceived += OnMessageReceivedAsync;
            _handlers.Add(handler);
            _idCounter++;
            _semaphore.Release();
            return handler;
        }

        private async Task NotifyUserConnectedAsync(WebSocketHandler WSHandler)
        {
            List<Task> tasks = new List<Task>();
            WebSocketHandler[] handlers = _handlers.ToArray();
            int totalHandlers = handlers.Length;

            string mensajeDemas = "amigo conectado";

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

                foreach (WebSocketHandler handler in handlers)
                {
                    if (amigos.Any(a => a.UsuarioId == handler.Id))
                    {
                        MensajeAmigoDTO message = new MensajeAmigoDTO
                        {
                            Message = mensajeDemas,
                            FriendId = WSHandler.Id,
                            Quantity = totalHandlers
                        };
                        string messageToSend = JsonSerializer.Serialize(message, JsonSerializerOptions.Web);
                        tasks.Add(handler.SendAsync(messageToSend));
                    }
                }
            }

            await Task.WhenAll(tasks);
        }

        private async Task OnDisconnectedAsync(WebSocketHandler disconnectedHandler)
        {
            await _semaphore.WaitAsync();
            disconnectedHandler.Disconnected -= OnDisconnectedAsync;
            disconnectedHandler.MessageReceived -= OnMessageReceivedAsync;
            _handlers.Remove(disconnectedHandler);
            _semaphore.Release();

            List<Task> tasks = new List<Task>();
            WebSocketHandler[] handlers = _handlers.ToArray();

            string message = $"Se ha desconectado el usuario con id {disconnectedHandler.Id}. Ahora hay {handlers.Length} usuarios conectados";

            foreach (WebSocketHandler handler in handlers)
            {
                tasks.Add(handler.SendAsync(message));
            }

            await Task.WhenAll(tasks);
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

                        // Notificar a ambos usuarios que la partida ha comenzado
                        var gameId = Guid.NewGuid().ToString();
                        var gameResponse = new
                        {
                            Type = "gameStarted",
                            GameId = gameId,
                            Opponent = player2.Id // ID del oponente
                        };
                        await player1.SendAsync(JsonSerializer.Serialize(gameResponse));

                        var gameResponse2 = new
                        {
                            Type = "gameStarted",
                            GameId = gameId,
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
                    var gameId = Guid.NewGuid().ToString();
                    var botResponse = new
                    {
                        Type = "botGameStarted",
                        GameId = gameId
                    };
                    await userHandler.SendAsync(JsonSerializer.Serialize(botResponse));
                }
                else if (messageObject.Type == "cancelSearch")
                {
                    // Cancelar la búsqueda de oponente
                    _waitingUsers.Remove(userHandler);
                    await userHandler.SendAsync(JsonSerializer.Serialize(new
                    {
                        Type = "searchCancelled"
                    }));
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error al procesar el mensaje: {ex.Message}");
            }
        }
    }
}
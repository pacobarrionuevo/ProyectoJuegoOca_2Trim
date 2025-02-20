using System.Net.WebSockets;
using System.Text.Json;
using JuegoOcaBack.Models.Database;
using JuegoOcaBack.Models.Database.Entidades;
using JuegoOcaBack.Models.DTO;

namespace JuegoOcaBack.WebSocketAdvanced
{
    public class WebSocketNetwork
    {
        private static int _idCounter = 0;
        private readonly List<WebSocketHandler> _handlers = new List<WebSocketHandler>();
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

        private Task OnMessageReceivedAsync(WebSocketHandler userHandler, string message)
        {
            List<Task> tasks = new List<Task>();
            WebSocketHandler[] handlers = _handlers.ToArray();

            string messageToMe = $"Tú: {message}";
            string messageToOthers = $"Usuario {userHandler.Id}: {message}";

            foreach (WebSocketHandler handler in handlers)
            {
                string messageToSend = handler.Id == userHandler.Id ? messageToMe : messageToOthers;
                tasks.Add(handler.SendAsync(messageToSend));
            }

            return Task.WhenAll(tasks);
        }
    }
}
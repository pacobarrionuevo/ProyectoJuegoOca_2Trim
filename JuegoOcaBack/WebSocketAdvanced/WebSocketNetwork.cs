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
        private static int _idCounter = 0;
        private readonly List<WebSocketHandler> _handlers = new List<WebSocketHandler>();
        private readonly List<WebSocketHandler> _waitingPlayers = new List<WebSocketHandler>();
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

        private async Task NotifyUserConnectedAsync(WebSocketHandler newHandler)
        {
            using (var scope = _serviceProvider.CreateScope())
            {
                var unitOfWork = scope.ServiceProvider.GetRequiredService<UnitOfWork>();
                var wsMethods = scope.ServiceProvider.GetRequiredService<WebSocketMethods>();
                Usuario usuario = await wsMethods.GetUserById(newHandler.Id);
                if (usuario != null)
                {
                    usuario.UsuarioEstado = "Conectado";
                    await wsMethods.UpdateUserAsync(usuario);
                }

                var amigos = await unitOfWork._friendRequestRepository.GetFriendsList(newHandler.Id);

                foreach (WebSocketHandler handler in _handlers)
                {
                    if (amigos.Any(a => a.UsuarioId == handler.Id))
                    {
                        await handler.SendAsync(JsonSerializer.Serialize(new
                        {
                            Type = "friendConnected",
                            FriendId = newHandler.Id
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
                _waitingPlayers.Remove(disconnectedHandler);
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
                    _waitingPlayers.Add(userHandler);

                    if (_waitingPlayers.Count >= 2)
                    {
                        var player1 = _waitingPlayers[0];
                        var player2 = _waitingPlayers[1];

                        if (player1.IsOpen && player2.IsOpen)
                        {
                            var roomId = Guid.NewGuid().ToString();
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

                            _waitingPlayers.Remove(player1);
                            _waitingPlayers.Remove(player2);
                        }
                        else
                        {
                            if (!player1.IsOpen)
                            {
                                _waitingPlayers.Remove(player1);
                                Console.WriteLine($"Jugador {player1.Id} no está conectado. Eliminado de la lista de espera.");
                            }

                            if (!player2.IsOpen)
                            {
                                _waitingPlayers.Remove(player2);
                                Console.WriteLine($"Jugador {player2.Id} no está conectado. Eliminado de la lista de espera.");
                            }
                        }
                    }
                    else
                    {
                        Console.WriteLine($"Usuario {userHandler.Id} en espera de oponente.");
                        await userHandler.SendAsync(JsonSerializer.Serialize(new
                        {
                            Type = "waitingForOpponent",
                            ConnectedUsers = _handlers.Count
                        }));
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
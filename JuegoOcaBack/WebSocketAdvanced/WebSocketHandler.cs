using System.IO;
using System.Net.WebSockets;
using System.Text;

namespace JuegoOcaBack.WebSocketAdvanced
{
    public class WebSocketHandler : IDisposable
    {
        private const int BufferSize = 4096;
        private readonly WebSocket _webSocket;
        private readonly byte[] _buffer;
        public MatchmakingMessage LastMessage { get; private set; } 

        public int Id { get; init; }
        public bool IsOpen => _webSocket.State == WebSocketState.Open;

        public event Func<WebSocketHandler, string, Task> MessageReceived;
        public event Func<WebSocketHandler, Task> Disconnected;
        public DateTime LastActivity { get; set; } = DateTime.UtcNow;
        public WebSocketHandler(int id, WebSocket webSocket)
        {
            Id = id;
            _webSocket = webSocket;
            _buffer = new byte[BufferSize];
        }

        public async Task HandleAsync()
        {
            while (IsOpen)
            {
                try
                {
                    string message = await ReadAsync();
                    
                    if (!string.IsNullOrWhiteSpace(message) && MessageReceived != null)
                    {
                        await MessageReceived.Invoke(this, message);
                    }

                }
                catch (WebSocketException)
                {
                    Dispose();
                }
            }

            if (Disconnected != null)
            {
                await Disconnected.Invoke(this);
            }
        }

        private async Task<string> ReadAsync()
        {
            using (var memoryStream = new MemoryStream()) // Usar bloque using con paréntesis
            {
                WebSocketReceiveResult receiveResult;

                do
                {
                    receiveResult = await _webSocket.ReceiveAsync(_buffer, CancellationToken.None);
                    if (receiveResult.MessageType == WebSocketMessageType.Text)
                    {
                        memoryStream.Write(_buffer, 0, receiveResult.Count);
                    }
                    else if (receiveResult.CloseStatus.HasValue)
                    {
                        await _webSocket.CloseAsync(
                            receiveResult.CloseStatus.Value,
                            receiveResult.CloseStatusDescription,
                            CancellationToken.None
                        );
                    }
                } while (!receiveResult.EndOfMessage);

                return Encoding.UTF8.GetString(memoryStream.ToArray());
            }
        }
        public async Task SendAsync(string message)
        {
            if (IsOpen)
            {
                byte[] bytes = Encoding.UTF8.GetBytes(message);
                await _webSocket.SendAsync(bytes, WebSocketMessageType.Text, true, CancellationToken.None);
            }
        }

        public void Dispose()
        {
            _webSocket.Dispose();
        }
    }
}

using System.Net.WebSockets;

namespace JuegoOcaBack.WebSocketAdvanced
{
    public class Middleware : IMiddleware
    {
        private readonly WebSocketNetwork _webSocketNetwork;

        public Middleware(WebSocketNetwork webSocketNetwork)
        {
            _webSocketNetwork = webSocketNetwork;
        }

        public async Task InvokeAsync(HttpContext context, RequestDelegate next)
        {
            if (context.Request.Path == "/ws" && context.WebSockets.IsWebSocketRequest)
            {
                using WebSocket webSocket = await context.WebSockets.AcceptWebSocketAsync();
                await _webSocketNetwork.HandleAsync(webSocket);
            }
            else
            {
                await next(context);
            }
        }
    }
}

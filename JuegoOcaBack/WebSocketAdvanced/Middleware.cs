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
            
            if (context.WebSockets.IsWebSocketRequest) {

                //coger token de la url y meterlo en la cabecera

                string token = context.Request.Query["token"];
                if (!string.IsNullOrEmpty(token))
                {
                    context.Request.Headers["Authorization"] = $"Bearer {token}";
                }

                using WebSocket webSocket = await context.WebSockets.AcceptWebSocketAsync();
                await _webSocketNetwork.HandleAsync(webSocket);
                
                return;
            }         
            
            else
            {
                await next(context);
            }
        }
    }
}

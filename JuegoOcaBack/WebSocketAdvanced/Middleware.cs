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

            if (context.WebSockets.IsWebSocketRequest)
            {

                //coger token de la url y meterlo en la cabecera

                string token = context.Request.Query["token"];
                if (!string.IsNullOrEmpty(token))
                {
                    context.Request.Headers["Authorization"] = $"Bearer {token}";
                }

                using WebSocket webSocket = await context.WebSockets.AcceptWebSocketAsync();
                int userId = ObtenerUserId(context);
                await _webSocketNetwork.HandleAsync(webSocket,  userId);

                return;
            }

            else
            {
                await next(context);
            }
        }
    
      private int ObtenerUserId(HttpContext context)
        {
            if (context.User.Identity.IsAuthenticated)
            {
                var userIdClaim = context.User.FindFirst("userId");
                if (userIdClaim != null && int.TryParse(userIdClaim.Value, out int userId))
                {
                    return userId;
                }
            }
            throw new UnauthorizedAccessException("Usuario no autenticado o userId no válido.");
        }
    }
}
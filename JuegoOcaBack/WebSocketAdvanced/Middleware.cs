using System.Net.WebSockets;
using System.Security.Claims;

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
                // Extraer token de la URL y agregarlo al header
                string token = context.Request.Query["token"];
                if (!string.IsNullOrEmpty(token))
                {
                    context.Request.Headers["Authorization"] = $"Bearer {token}";
                }
                var username = context.User.FindFirst("apodo")?.Value
                       ?? context.User.FindFirst("unique_name")?.Value
                       ?? "Desconocido";
                using WebSocket webSocket = await context.WebSockets.AcceptWebSocketAsync();
                int userId = ObtenerUserId(context);
                await _webSocketNetwork.HandleAsync( webSocket, userId, username);
                return;
            }
            else
            {
                await next(context);
            }
        }

        private int ObtenerUserId(HttpContext context)
        {
            if (!context.User.Identity.IsAuthenticated)
            {
                throw new UnauthorizedAccessException("Usuario no autenticado");
            }
            var userIdClaim = context.User.FindFirst("id");
            if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out int userId))
            {
                throw new UnauthorizedAccessException("Claim 'id' no encontrada o inválida");
            }

            return userId;
        }
    }
}
using System.Net.WebSockets;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;
using JuegoOcaBack.WebSocketAdvanced;

namespace JuegoOcaBack.Controllers
{
    [Route("ws")]
    [ApiController]
    public class WebSocketController : ControllerBase
    {
        private readonly WebSocketNetwork _websocketNetwork;

        public WebSocketController(WebSocketNetwork websocketNetwork)
        {
            _websocketNetwork = websocketNetwork;
        }

        [HttpGet("connect")]
        public async Task ConnectAsync()
        {
            if (HttpContext.WebSockets.IsWebSocketRequest)
            {
                WebSocket webSocket = await HttpContext.WebSockets.AcceptWebSocketAsync();
                var handler = await _websocketNetwork.HandleAsync(webSocket);

                handler.Disconnected += async (disconnectedHandler) =>
                {
                    await OnDisconnectedAsync(disconnectedHandler);
                };
            }
            else
            {
                HttpContext.Response.StatusCode = StatusCodes.Status400BadRequest;
            }
        }

        private async Task OnDisconnectedAsync(WebSocketHandler disconnectedHandler)
        {
            await _websocketNetwork.RemoveHandlerAsync(disconnectedHandler);
        }
    }
}

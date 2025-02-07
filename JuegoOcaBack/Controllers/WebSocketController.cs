﻿using System.Net.WebSockets;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;
using JuegoOcaBack.WebSocketAdvanced; 

namespace TuNamespace.Controllers
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
                await _websocketNetwork.HandleAsync(webSocket);
            }
            else
            {
                HttpContext.Response.StatusCode = StatusCodes.Status400BadRequest;
            }
        }
    }
}

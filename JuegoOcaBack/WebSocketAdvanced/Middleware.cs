namespace JuegoOcaBack.WebSocketAdvanced
{
    public class Middleware : IMiddleware
    {
        public async Task InvokeAsync(HttpContext context, RequestDelegate next)
        {
            // Código antes de procesar la solicitud

            await next(context);

            // Código después de procesar la solicitud
        }
    }
}

using JuegoOcaBack.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace JuegoOcaBack.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class MenuController : ControllerBase
    {
        private readonly SmartSearchService _smartSearchService;
        public MenuController( SmartSearchService smartSearchService)
        {
            _smartSearchService = smartSearchService;
        }
    }
    
}

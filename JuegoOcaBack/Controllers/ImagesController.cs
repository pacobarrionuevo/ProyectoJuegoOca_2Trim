using JuegoOcaBack.Models.DTO;
using JuegoOcaBack.Models.Mappers;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using static System.Net.Mime.MediaTypeNames;

namespace JuegoOcaBack.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ImageController : ControllerBase
    {
        private readonly ImageService _service;
        private readonly ImageMapper _mapper;

        public ImagesController(ImageService service, ImageMapper mapper)
        {
            _service = service;
            _mapper = mapper;
        }

        [HttpGet]
        public async Task<IEnumerable<ImageDto>> GetAllAsync()
        {
            IEnumerable<Image> images = await _service.GetAllAsync();

            return _mapper.ToDto(images, Request);
        }

        [HttpGet("{id}")]
        public async Task<ImageDto> GetAsync(long id)
        {
            Image image = await _service.GetAsync(id);

            return _mapper.ToDto(image, Request);
        }

        [HttpPost]
        public async Task<ActionResult<ImageDto>> InsertAsync(CreateUpdateImageRequest createImage)
        {
            Image newImage = await _service.InsertAsync(createImage);

            return Created($"images/{newImage.Id}", _mapper.ToDto(newImage));
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<ImageDto>> UpdateAsync(long id, CreateUpdateImageRequest updateImage)
        {
            Image imageUpdated = await _service.UpdateAsync(id, updateImage);

            return Ok(_mapper.ToDto(imageUpdated));
        }

        [HttpDelete("{id}")]
        public async Task<ActionResult<ImageDto>> DeleteAsync(long id)
        {
            await _service.DeleteAsync(id);

            return NoContent();
        }
    }
}

using JuegoOcaBack.Extensions;
using JuegoOcaBack.Models.Database.Entidades;
using JuegoOcaBack.Models.DTO;

namespace JuegoOcaBack.Models.Mappers
{
    public class ImageMapper
    {
        public ImageDto ToDto(Image image, HttpRequest httpRequest = null)
        {
            return new ImageDto()
            {
                Id = image.Id,
                Name = image.Name,
                Url = httpRequest is null ? image.Path : httpRequest.GetAbsoluteUrl(image.Path),
            };
        }

        public IEnumerable<ImageDto> ToDto(IEnumerable<Image> images, HttpRequest httpRequest = null)
        {
            return images.Select(image => ToDto(image, httpRequest));
        }
    }
}

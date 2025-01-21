using JuegoOcaBack.Models.Database;
using JuegoOcaBack.Models.Database.Entidades;
using JuegoOcaBack.Models.DTO;
using JuegoOcaBack.Recursos;

namespace JuegoOcaBack.Services
{
    public class ImageService
    {
        private const string IMAGES_FOLDER = "fotos";

        private readonly UnitOfWork _unitOfWork;

        public ImageService(UnitOfWork unitOfWork)
        {
            _unitOfWork = unitOfWork;
        }

        public Task<ICollection<Image>> GetAllAsync()
        {
            return _unitOfWork._imageRepository.GetAllAsync();
        }

        public Task<Image> GetAsync(long id)
        {
            return _unitOfWork._imageRepository.GetByIdAsync(id);
        }

        public async Task<Image> InsertAsync(CreateUpdateImageRequest image)
        {
            string relativePath = $"{IMAGES_FOLDER}/{Guid.NewGuid()}_{image.File.FileName}";

            Image newImage = new Image
            {
                Name = image.Name,
                Path = relativePath
            };

            await _unitOfWork._imageRepository.InsertAsync(newImage);

            if (await _unitOfWork.SaveAsync())
            {
                await StoreImageAsync(relativePath, image.File);
            }

            return newImage;
        }

        public async Task<Image> UpdateAsync(long id, CreateUpdateImageRequest image)
        {
            Image entity = await _unitOfWork._imageRepository.GetByIdAsync(id);
            entity.Name = image.Name;

            _unitOfWork._imageRepository.Update(entity);

            if (await _unitOfWork.SaveAsync() && image.File != null)
            {
                await StoreImageAsync(entity.Path, image.File);
            }

            return entity;
        }

        public async Task DeleteAsync(long id)
        {
            Image image = await _unitOfWork._imageRepository.GetByIdAsync(id);
            _unitOfWork._imageRepository.Delete(image);

            await _unitOfWork.SaveAsync();
        }

        private async Task StoreImageAsync(string relativePath, IFormFile file)
        {
            using Stream stream = file.OpenReadStream();

            await FileHelper.SaveAsync(stream, relativePath);
        }
    }
}

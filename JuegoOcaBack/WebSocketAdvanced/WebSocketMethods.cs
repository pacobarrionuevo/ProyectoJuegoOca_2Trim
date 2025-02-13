using JuegoOcaBack.Models.Database.Entidades;
using JuegoOcaBack.Models.Database;

namespace JuegoOcaBack.WebSocketAdvanced
{
    public class WebSocketMethods
    {
        private readonly UnitOfWork _unitOfWork;

        public WebSocketMethods(UnitOfWork unitOfWork)
        {
            _unitOfWork = unitOfWork;
        }
        public async Task<Usuario> GetUserById(int id)
        {
            return await _unitOfWork._userRepository.GetByIdAsync(id);
        }

        public async Task UpdateUserAsync(Usuario user)
        {
            _unitOfWork._userRepository.Update(user);
            await _unitOfWork.SaveAsync();
        }
    }
}

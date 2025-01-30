using JuegoOcaBack.Models.Database;
using JuegoOcaBack.Models.Database.Entidades;

namespace JuegoOcaBack.Services
{
    public class FriendRequestService
    {
        private readonly UnitOfWork _unitOfWork;

        public FriendRequestService(UnitOfWork unitOfWork)
        {
            _unitOfWork = unitOfWork;
        }

        public async Task<bool> EnviarSolicitudAsync(int senderId, int receiverId)
        {
            return await _unitOfWork._friendRequestRepository.EnviarSolicitudAsync(senderId, receiverId);
        }

        public async Task<bool> AceptarSolicitudAsync(int senderId, int receiverId)
        {
            return await _unitOfWork._friendRequestRepository.AcceptFriendRequestAsync(senderId, receiverId);
        }

        public async Task<bool> EliminarAmistadAsync(int userId, int friendId)
        {
            return await _unitOfWork._friendRequestRepository.RemoveFriendAsync(userId, friendId);
        }

        public async Task<List<Usuario>> ObtenerAmigosAsync(int usuarioId)
        {
            return await _unitOfWork._friendRequestRepository.ObtenerAmigosAsync(usuarioId);
        }
    }
}

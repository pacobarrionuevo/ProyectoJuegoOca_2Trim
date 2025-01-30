using JuegoOcaBack.Models.Database;
using JuegoOcaBack.Models.Database.Entidades;
using Microsoft.EntityFrameworkCore;

namespace JuegoOcaBack.Services
{
    public class FriendRequestService
    {
        private readonly UnitOfWork _unitOfWork;

        public FriendRequestService(UnitOfWork unitOfWork)
        {
            _unitOfWork = unitOfWork;
        }

        public async Task AddFriendRequest(int senderId, int receiverId)
        {
            var sender = await _unitOfWork._userRepository.GetByIdAsync(senderId);
            var receiver = await _unitOfWork._userRepository.GetByIdAsync(receiverId);

            if (sender == null || receiver == null)
                throw new Exception("Uno o ambos usuarios no existen.");

            var friendship = new Friendship
            {
                Users = new List<Usuario> { sender, receiver },
                IsAccepted = false
            };

            await _unitOfWork._friendRequestRepository.InsertAsync(friendship);
            await _unitOfWork.SaveAsync();
        }

        public async Task AcceptFriendRequest(int senderId, int receiverId)
        {
            var friendship = await _unitOfWork._friendRequestRepository
                .GetQueryable()
                .FirstOrDefaultAsync(f => f.Users.Any(u => u.UsuarioId == senderId) &&
                                          f.Users.Any(u => u.UsuarioId == receiverId) &&
                                          !f.IsAccepted);

            if (friendship != null)
            {
                friendship.IsAccepted = true;
                _unitOfWork._friendRequestRepository.Update(friendship);
                await _unitOfWork.SaveAsync();
            }
        }

        public async Task RejectFriendRequest(int senderId, int receiverId)
        {
            var friendship = await _unitOfWork._friendRequestRepository
                .GetQueryable()
                .FirstOrDefaultAsync(f => f.Users.Any(u => u.UsuarioId == senderId) &&
                                          f.Users.Any(u => u.UsuarioId == receiverId) &&
                                          !f.IsAccepted);

            if (friendship != null)
            {
                _unitOfWork._friendRequestRepository.Delete(friendship);
                await _unitOfWork.SaveAsync();
            }
        }

        public async Task<List<Usuario>> GetFriends(int userId)
        {
            var friendships = await _unitOfWork._friendRequestRepository
                .GetQueryable()
                .Where(f => f.Users.Any(u => u.UsuarioId == userId) && f.IsAccepted)
                .ToListAsync();

            return friendships.SelectMany(f => f.Users)
                              .Where(u => u.UsuarioId != userId)
                              .Distinct()
                              .ToList();
        }

        public async Task<List<Friendship>> GetPendingRequests(int userId)
        {
            return await _unitOfWork._friendRequestRepository
                .GetQueryable()
                .Where(f => f.Users.Any(u => u.UsuarioId == userId) && !f.IsAccepted)
                .ToListAsync();
        }
    }
}

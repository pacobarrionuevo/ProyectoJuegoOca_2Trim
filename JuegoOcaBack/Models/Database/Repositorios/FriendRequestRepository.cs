using JuegoOcaBack.Models.Database.Entidades;
using Microsoft.EntityFrameworkCore;

namespace JuegoOcaBack.Models.Database.Repositorios
{
    public class FriendRequestRepository : Repositorio<FriendRequest>
    {
        private readonly DBContext _context;

        public FriendRequestRepository(DBContext context) : base(context)
        {
            _context = context;
        }

        public async Task<bool> EnviarSolicitudAsync(int senderId, int receiverId)
        {
            bool solicitudExiste = await _context.FriendRequests.AnyAsync(r =>
                (r.SenderId == senderId && r.ReceiverId == receiverId) ||
                (r.SenderId == receiverId && r.ReceiverId == senderId));

            if (solicitudExiste)
                return false;

            var nuevaSolicitud = new FriendRequest
            {
                SenderId = senderId,
                ReceiverId = receiverId,
                Accepted = false
            };

            _context.FriendRequests.Add(nuevaSolicitud);
            return await _context.SaveChangesAsync() > 0;
        }

        public async Task<bool> AcceptFriendRequestAsync(int senderId, int receiverId)
        {
            var request = await _context.FriendRequests
                .FirstOrDefaultAsync(r => r.SenderId == senderId && r.ReceiverId == receiverId);

            if (request == null)
                return false;

            var friendship1 = new Friendship { UserId = senderId, FriendId = receiverId };
            var friendship2 = new Friendship { UserId = receiverId, FriendId = senderId };

            _context.Friendships.AddRange(friendship1, friendship2);
            _context.FriendRequests.Remove(request);

            return await _context.SaveChangesAsync() > 0;
        }

        public async Task<bool> RemoveFriendAsync(int userId, int friendId)
        {
            var friendships = await _context.Friendships
                .Where(f => (f.UserId == userId && f.FriendId == friendId) ||
                            (f.UserId == friendId && f.FriendId == userId))
                .ToListAsync();

            if (!friendships.Any())
                return false;

            _context.Friendships.RemoveRange(friendships);
            return await _context.SaveChangesAsync() > 0;
        }

        public async Task<List<Usuario>> ObtenerAmigosAsync(int usuarioId)
        {
            return await _context.Friendships
                .Where(f => f.UserId == usuarioId)
                .Select(f => f.Friend)
                .ToListAsync();
        }

    }
}

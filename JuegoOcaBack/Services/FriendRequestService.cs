using JuegoOcaBack.Models.Database;
using JuegoOcaBack.Models.Database.Entidades;
using JuegoOcaBack.Models.Database.Repositorios;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace JuegoOcaBack.Services
{
    public class FriendRequestService
    {
        private readonly UnitOfWork _unitOfWork;

        public FriendRequestService(UnitOfWork unitOfWork)
        {
            _unitOfWork = unitOfWork;
        }

        public async Task<bool> SendFriendRequest(int senderId, int receiverId)
        {
            var sender = await _unitOfWork._context.Usuarios.FindAsync(senderId);
            var receiver = await _unitOfWork._context.Usuarios.FindAsync(receiverId);

            if (sender == null || receiver == null) return false;

            var amistad = new Amistad { IsAccepted = false };

            _unitOfWork._context.Friendships.Add(amistad);
            await _unitOfWork.SaveAsync();

            _unitOfWork._context.UsuarioTieneAmistad.Add(new UsuarioTieneAmistad
            {
                UsuarioId = senderId,
                AmistadId = amistad.AmistadId,
                usuario = sender,
                amistad = amistad
            });

            _unitOfWork._context.UsuarioTieneAmistad.Add(new UsuarioTieneAmistad
            {
                UsuarioId = receiverId,
                AmistadId = amistad.AmistadId,
                usuario = receiver,
                amistad = amistad
            });

            return await _unitOfWork.SaveAsync();
        }

        public async Task<bool> AcceptFriendRequest(int amistadId)
        {
            var amistad = await _unitOfWork._friendRequestRepository.GetByIdAsync(amistadId);
            if (amistad == null) return false;

            amistad.IsAccepted = true;
            _unitOfWork._friendRequestRepository.Update(amistad);

            return await _unitOfWork.SaveAsync();
        }

        public async Task<bool> RejectFriendRequest(int amistadId)
        {
            var amistad = await _unitOfWork._friendRequestRepository.GetByIdAsync(amistadId);
            if (amistad == null) return false;

            _unitOfWork._friendRequestRepository.Delete(amistad);

            return await _unitOfWork.SaveAsync();
        }

        public async Task<List<Usuario>> GetFriendsList(int usuarioId)
        {
            return await _unitOfWork._context.UsuarioTieneAmistad
                .Include(uta => uta.amistad)
                .Include(uta => uta.usuario)
                .Where(uta => uta.amistad.IsAccepted && uta.amistad.AmistadUsuario.Any(au => au.UsuarioId == usuarioId))
                .Select(uta => uta.usuario)
                .ToListAsync();
        }

        public async Task<List<Amistad>> GetPendingFriendRequests(int usuarioId)
        {
            return await _unitOfWork._context.UsuarioTieneAmistad
                .Include(uta => uta.amistad)
                .Include(uta => uta.usuario)
                .Where(uta => uta.UsuarioId == usuarioId && !uta.amistad.IsAccepted)
                .Select(uta => uta.amistad)
                .ToListAsync();
        }
    }
}

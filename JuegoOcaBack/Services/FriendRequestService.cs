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
            var amistad = new Amistad
            {
                IsAccepted = false
            };

            await _unitOfWork._friendRequestRepository.InsertAsync(amistad);
            await _unitOfWork.SaveAsync();

            var usuarioTieneAmistadSender = new UsuarioTieneAmistad
            {
                UsuarioId = senderId,
                AmistadId = amistad.AmistadId,
                usuario = await _unitOfWork._context.Usuarios.FindAsync(senderId),
                amistad = amistad
            };

            var usuarioTieneAmistadReceiver = new UsuarioTieneAmistad
            {
                UsuarioId = receiverId,
                AmistadId = amistad.AmistadId,
                usuario = await _unitOfWork._context.Usuarios.FindAsync(receiverId),
                amistad = amistad
            };

            _unitOfWork._context.UsuarioTieneAmistad.Add(usuarioTieneAmistadSender);
            _unitOfWork._context.UsuarioTieneAmistad.Add(usuarioTieneAmistadReceiver);

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
            var amigos = new List<Usuario>();
            var usuarioTieneAmistades = await _unitOfWork._context.UsuarioTieneAmistad
                .Include(uta => uta.amistad)
                .Include(uta => uta.usuario)
                .Where(uta => uta.UsuarioId == usuarioId && uta.amistad.IsAccepted)
                .ToListAsync();

            foreach (var uta in usuarioTieneAmistades)
            {
                var amigo = await _unitOfWork._context.UsuarioTieneAmistad
                    .Include(uta => uta.usuario)
                    .Where(uta => uta.AmistadId == uta.amistad.AmistadId && uta.UsuarioId != usuarioId)
                    .Select(uta => uta.usuario)
                    .FirstOrDefaultAsync();

                if (amigo != null)
                {
                    amigos.Add(amigo);
                }
            }

            return amigos;
        }

        public async Task<List<Amistad>> GetPendingFriendRequests(int usuarioId)
        {
            var solicitudesPendientes = await _unitOfWork._context.UsuarioTieneAmistad
                .Include(uta => uta.amistad)
                .Include(uta => uta.usuario)
                .Where(uta => uta.UsuarioId == usuarioId && !uta.amistad.IsAccepted)
                .Select(uta => uta.amistad)
                .ToListAsync();

            return solicitudesPendientes;
        }
    }
}
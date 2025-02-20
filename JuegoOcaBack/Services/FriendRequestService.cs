using JuegoOcaBack.Models.Database;
using JuegoOcaBack.Models.Database.Entidades;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace JuegoOcaBack.Services
{
    public class FriendRequestService
    {
        private readonly DBContext _context;

        public FriendRequestService(DBContext context)
        {
            _context = context;
        }

        // Envía una solicitud de amistad
        public class FriendRequestResult
        {
            public bool Success { get; set; }
            public int AmistadId { get; set; }
            public string SenderName { get; set; }
        }

        public async Task<FriendRequestResult> SendFriendRequest(int senderId, int receiverId)
        {
            // Evitar solicitud a uno mismo
            if (senderId == receiverId)
                return new FriendRequestResult { Success = false };

            // Verificar que no exista ya una solicitud pendiente o amistad entre estos usuarios
            var exists = await _context.Friendships
                .Include(a => a.AmistadUsuario)
                .AnyAsync(a =>
                    !a.IsAccepted &&
                    a.AmistadUsuario.Any(ua => ua.UsuarioId == senderId) &&
                    a.AmistadUsuario.Any(ua => ua.UsuarioId == receiverId)
                );
            if (exists)
                return new FriendRequestResult { Success = false };

            // Crear la solicitud en estado pendiente
            var amistad = new Amistad() { IsAccepted = false };
            _context.Friendships.Add(amistad);
            await _context.SaveChangesAsync(); // Para obtener el AmistadId generado

            // Crear la relación: sender es el requestor y receiver es el que recibe la solicitud
            var senderRelation = new UsuarioTieneAmistad()
            {
                UsuarioId = senderId,
                AmistadId = amistad.AmistadId,
                esQuienMandaSolicitud = true
            };

            var receiverRelation = new UsuarioTieneAmistad()
            {
                UsuarioId = receiverId,
                AmistadId = amistad.AmistadId,
                esQuienMandaSolicitud = false
            };

            _context.UsuarioTieneAmistad.AddRange(senderRelation, receiverRelation);
            await _context.SaveChangesAsync();

            // Recuperar el nombre del sender
            var sender = await _context.Usuarios.FindAsync(senderId);

            return new FriendRequestResult
            {
                Success = true,
                AmistadId = amistad.AmistadId,
                SenderName = sender?.UsuarioApodo
            };
        }


        // Acepta una solicitud de amistad
        // receiverId se obtiene del token (usuario autenticado) para mayor seguridad
        public async Task<bool> AcceptFriendRequest(int amistadId, int receiverId)
        {
            var amistad = await _context.Friendships
                .Include(a => a.AmistadUsuario)
                .FirstOrDefaultAsync(a => a.AmistadId == amistadId && !a.IsAccepted);

            if (amistad == null)
                return false;

            // Verificar que el usuario que acepta es el receptor (no el requestor)
            var receiverRecord = amistad.AmistadUsuario
                .FirstOrDefault(ua => ua.UsuarioId == receiverId && ua.esQuienMandaSolicitud == false);

            if (receiverRecord == null)
                return false;

            amistad.IsAccepted = true;
            await _context.SaveChangesAsync();

            return true;
        }

        // Rechaza (o cancela) una solicitud de amistad
        public async Task<bool> RejectFriendRequest(int amistadId, int receiverId)
        {
            var amistad = await _context.Friendships
                .Include(a => a.AmistadUsuario)
                .FirstOrDefaultAsync(a => a.AmistadId == amistadId && !a.IsAccepted);

            if (amistad == null)
                return false;

            var receiverRecord = amistad.AmistadUsuario
                .FirstOrDefault(ua => ua.UsuarioId == receiverId && ua.esQuienMandaSolicitud == false);

            if (receiverRecord == null)
                return false;

            // Eliminar la solicitud y las relaciones asociadas
            _context.UsuarioTieneAmistad.RemoveRange(amistad.AmistadUsuario);
            _context.Friendships.Remove(amistad);
            await _context.SaveChangesAsync();

            return true;
        }

        // Obtiene la lista de amigos (amistades aceptadas) del usuario
        public async Task<List<Usuario>> GetFriendsList(int usuarioId)
        {
            var friendships = await _context.Friendships
                .Include(a => a.AmistadUsuario)
                    .ThenInclude(ua => ua.usuario)
                .Where(a => a.IsAccepted && a.AmistadUsuario.Any(ua => ua.UsuarioId == usuarioId))
                .ToListAsync();

            List<Usuario> friends = new List<Usuario>();
            foreach (var amistad in friendships)
            {
                // Se extrae el usuario que NO es el usuario logueado
                var friendRelation = amistad.AmistadUsuario.FirstOrDefault(ua => ua.UsuarioId != usuarioId);
                if (friendRelation != null && friendRelation.usuario != null)
                    friends.Add(friendRelation.usuario);
            }
            return friends;
        }

        // Obtiene las solicitudes de amistad pendientes en las que el usuario es receptor
        public async Task<List<Amistad>> GetPendingFriendRequests(int usuarioId)
        {
            var pendingRequests = await _context.Friendships
                .Include(a => a.AmistadUsuario)
                .Where(a => !a.IsAccepted &&
                       a.AmistadUsuario.Any(ua => ua.UsuarioId == usuarioId && ua.esQuienMandaSolicitud == false))
                .ToListAsync();

            return pendingRequests;
        }
    }
}

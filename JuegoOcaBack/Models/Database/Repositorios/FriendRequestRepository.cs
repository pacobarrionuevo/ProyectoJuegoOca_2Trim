using JuegoOcaBack.Models.Database.Entidades;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace JuegoOcaBack.Models.Database.Repositorios
{
    public class FriendRequestRepository : Repositorio<Amistad>
    {
        private readonly DBContext _context;

        public FriendRequestRepository(DBContext context) : base(context)
        {
            _context = context;
        }

        public async Task<List<Usuario>> GetFriendsList(int usuarioId)
        {
            return await _context.UsuarioTieneAmistad
                .Include(uta => uta.amistad)
                .Include(uta => uta.usuario)
                .Where(uta => uta.amistad.IsAccepted &&
                              uta.UsuarioId != usuarioId &&
                              uta.amistad.AmistadUsuario.Any(au => au.UsuarioId == usuarioId))
                .Select(uta => uta.usuario)
                .ToListAsync();
        }
    }
}

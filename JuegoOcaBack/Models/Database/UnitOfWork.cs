using JuegoOcaBack.Models.Database.Repositorios;

namespace JuegoOcaBack.Models.Database
{
    public class UnitOfWork
    {
        //El unitofwork es muy parecido a lo que tiene Jose (evidentemente adaptado a lo nuestro)
        public readonly DBContext _context;

        //Todas los repositorios de los productos que queremos guardar
        public ImageRepository _imageRepository { get; init; }
        public FriendRequestRepository _friendRequestRepository { get; init; }
        public UserRepository _userRepository { get; init; }

        public UnitOfWork(DBContext context, ImageRepository imageRepository, FriendRequestRepository FriendRequestRepository, UserRepository userRepository)
        {
            _context = context;
            _imageRepository = imageRepository;
            _friendRequestRepository = FriendRequestRepository;
            _userRepository = userRepository;
        }

        //Método para guardar
        public async Task<bool> SaveAsync()
        {
            return await _context.SaveChangesAsync() > 0;
        }
    }
}

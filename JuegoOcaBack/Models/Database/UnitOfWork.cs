namespace JuegoOcaBack.Models.Database
{
    public class UnitOfWork
    {
        //El unitofwork es muy parecido a lo que tiene Jose (evidentemente adaptado a lo nuestro)
        private readonly DBContext _context;

        //Todas los repositorios de los productos que queremos guardar


        // Exponer el DbContext
        public DBContext Context => _context;

        public UnitOfWork(DBContext context)
        {
            _context = context;
        }

        //Método para guardar
        public async Task<bool> SaveAsync()
        {
            return await _context.SaveChangesAsync() > 0;
        }
    }
}

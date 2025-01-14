namespace JuegoOcaBack.Models.Database
{
    public class UnitOfWork
    {
        //El unitofwork es muy parecido a lo que tiene Jose (evidentemente adaptado a lo nuestro)
        private readonly ProyectoDbContext _context;

        //Todas los repositorios de los productos que queremos guardar


        // Exponer el DbContext
        public ProyectoDbContext Context => _context;

        public UnitOfWork(ProyectoDbContext context)
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

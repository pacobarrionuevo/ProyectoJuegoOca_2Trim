﻿using JuegoOcaBack.Models.Database.Repositorios;

namespace JuegoOcaBack.Models.Database
{
    public class UnitOfWork
    {
        //El unitofwork es muy parecido a lo que tiene Jose (evidentemente adaptado a lo nuestro)
        private readonly DBContext _context;

        //Todas los repositorios de los productos que queremos guardar
        public ImageRepository _imageRepository { get; init; }

        public UnitOfWork(DBContext context, ImageRepository imageRepository)
        {
            _context = context;
            _imageRepository = imageRepository;
        }

        //Método para guardar
        public async Task<bool> SaveAsync()
        {
            return await _context.SaveChangesAsync() > 0;
        }
    }
}

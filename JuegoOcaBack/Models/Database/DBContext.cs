using JuegoOcaBack.Models.Database.Entidades;
using Microsoft.AspNetCore.Mvc.ViewEngines;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using System.Collections.Generic;

namespace JuegoOcaBack.Models.Database
{
    public class DBContext : DbContext
    {
        //Nombre de la base de datos y luego se llama ahi
        private const string DATABASE_PATH = "JuegoOcaApp.db";

        private readonly Settings _settings;

        //Tablas de la base de datos

        public DbSet<Usuario> Usuarios { get; set; }
        public DbSet<Image> Images { get; set; }
        public DbSet<Amistad> Friendships { get; set; }
        public DbSet<UsuarioTieneAmistad> UsuarioTieneAmistad { get; set; }

        // Configuramos el EntityFramework para crear un archivo de BBDD Sqlite

        /*
        public DBContext(IOptions<Settings> options)
        {
            _settings = options.Value;
        }
        */

        protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
        {
            string connection = "Server=db14832.databaseasp.net; Database=db14832; Uid=db14832; Pwd=c?3M7nZ%D6#z";

            #if DEBUG
                        string baseDir = AppDomain.CurrentDomain.BaseDirectory;
            optionsBuilder.UseSqlite($"DataSource={baseDir}{DATABASE_PATH}");
#else
                        
                        optionsBuilder.UseMySql(connection, ServerVersion.AutoDetect(connection));
#endif
        }
    }

}

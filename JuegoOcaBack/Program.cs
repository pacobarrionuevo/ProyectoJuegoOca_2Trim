//Las imagenes se crean en el directorio base
using System.Text;
using System.Text.Json.Serialization;
using JuegoOcaBack;
using JuegoOcaBack.Models.Database;
using JuegoOcaBack.Models.Database.Repositorios;
using JuegoOcaBack.Models.Mappers;
using JuegoOcaBack.Services;
using Microsoft.IdentityModel.Tokens;

Directory.SetCurrentDirectory(AppContext.BaseDirectory);

var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<Settings>(builder.Configuration.GetSection(Settings.SECTION_NAME));

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddControllers().AddJsonOptions(options =>
{
    options.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
});

builder.Services.AddScoped<DBContext>();
builder.Services.AddScoped<UnitOfWork>();
builder.Services.AddScoped<ImageRepository>();

builder.Services.AddTransient<ImageService>();

builder.Services.AddTransient<ImageMapper>();

// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Configuración del CORS
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(builder =>
    {
        builder.AllowAnyOrigin()
               .AllowAnyMethod()
               .AllowAnyHeader();
    });
});

builder.Services.AddAuthentication().AddJwtBearer(options =>
{
    Settings settings = builder.Configuration.GetSection(Settings.SECTION_NAME).Get<Settings>();
    string key = settings.JwtKey;

    options.TokenValidationParameters = new TokenValidationParameters()
    {
        //Pagina 94 del PDF de Jose
        ValidateIssuer = false,
        ValidateAudience = false,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key))
    };
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseCors();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

await InitDatabaseAsync(app.Services);

// Empezamos a atender a las peticiones de nuestro servidor 
await app.RunAsync();

//Método de Jose para iniciar la base de datos
static async Task InitDatabaseAsync(IServiceProvider serviceProvider)
{
    using IServiceScope scope = serviceProvider.CreateScope();
    using DBContext dbContext = scope.ServiceProvider.GetService<DBContext>();

    // Si no existe la base de datos entonces la creamos y ejecutamos el seeder
    if (dbContext.Database.EnsureCreated())
    {
        Seeder seeder = new Seeder(dbContext);
        await seeder.SeedAsync();
    }
}

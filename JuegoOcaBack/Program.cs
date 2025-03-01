using System.Text;
using System.Text.Json.Serialization;
using JuegoOcaBack;
using JuegoOcaBack.Models.Database;
using JuegoOcaBack.Models.Database.Repositorios;
using JuegoOcaBack.Models.Mappers;
using JuegoOcaBack.Services;
using JuegoOcaBack.WebSocketAdvanced;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

Directory.SetCurrentDirectory(AppContext.BaseDirectory);

var builder = WebApplication.CreateBuilder(args);

// Configuración inicial
builder.Services.Configure<Settings>(builder.Configuration.GetSection(Settings.SECTION_NAME));
builder.Services.AddSingleton(sp => sp.GetRequiredService<IOptions<Settings>>().Value);

// Servicios principales
builder.Services.AddControllers().AddJsonOptions(options => {
    options.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
});

// Configuración de la base de datos
builder.Services.AddScoped<DBContext>();
builder.Services.AddScoped<UnitOfWork>();
builder.Services.AddScoped<ImageRepository>();
builder.Services.AddScoped<FriendRequestRepository>();
builder.Services.AddScoped<UserRepository>();
builder.Services.AddScoped<WebSocketMethods>();

// Servicios de aplicación
builder.Services.AddTransient<ImageService>();
builder.Services.AddTransient<FriendRequestService>();
builder.Services.AddTransient<ImageMapper>();
builder.Services.AddSingleton<GameService>();
builder.Services.AddSingleton<WebSocketNetwork>();
builder.Services.AddTransient<Middleware>();

// Swagger
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// CORS
builder.Services.AddCors(options => {
    options.AddDefaultPolicy(builder => {
        builder.AllowAnyOrigin()
               .AllowAnyMethod()
               .AllowAnyHeader();
    });
});

// Autenticación JWT
var jwtSettings = builder.Configuration.GetSection(Settings.SECTION_NAME).Get<Settings>();
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options => {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = false,
            ValidateAudience = false,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSettings.JwtKey))
        };

        // Soporte para token en query string
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context => {
                context.Token = context.Request.Query["token"];
                return Task.CompletedTask;
            }
        };
    });

var app = builder.Build();

// Pipeline de middlewares
app.UseSwagger();
app.UseSwaggerUI();

// Middleware para mover token de query a header
app.Use(async (context, next) => {
    var token = context.Request.Query["token"];
    if (!string.IsNullOrEmpty(token))
    {
        context.Request.Headers["Authorization"] = $"Bearer {token}";
    }
    await next();
});
app.UseStaticFiles();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.UseWebSockets();
app.UseMiddleware<Middleware>();
app.UseHttpsRedirection();
app.MapControllers();

// Inicialización de base de datos
await InitDatabaseAsync(app.Services);

await app.RunAsync();

static async Task InitDatabaseAsync(IServiceProvider serviceProvider)
{
    using var scope = serviceProvider.CreateScope();
    using var dbContext = scope.ServiceProvider.GetService<DBContext>();

    if (dbContext.Database.EnsureCreated())
    {
        var seeder = new Seeder(dbContext);
        await seeder.SeedAsync();
    }
}
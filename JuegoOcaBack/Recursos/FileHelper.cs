namespace JuegoOcaBack.Recursos
{
    public static class FileHelper
    {
        public static string WwwrootPath { get; } = Path.Combine(AppContext.BaseDirectory, "wwwroot");

        public static async Task SaveAsync(byte[] bytes, string relativePath)
        {
            string absolutePath = Path.Combine(WwwrootPath, relativePath);
            Directory.CreateDirectory(Path.GetDirectoryName(absolutePath)!);
            await File.WriteAllBytesAsync(absolutePath, bytes);
        }

        public static async Task SaveAsync(Stream stream, string relativePath)
        {
            using MemoryStream ms = new();
            await stream.CopyToAsync(ms);
            await SaveAsync(ms.ToArray(), relativePath);
        }
    }
}


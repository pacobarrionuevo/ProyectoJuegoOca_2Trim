namespace JuegoOcaBack.Models.DTO
{
    public class PlayerDTO
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public int Position { get; set; }
        public int TurnsToSkip { get; set; }
    }
}
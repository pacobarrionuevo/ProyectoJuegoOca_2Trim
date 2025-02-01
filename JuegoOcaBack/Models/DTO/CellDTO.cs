namespace JuegoOcaBack.Models.DTO
{
    public class CellDTO
    {
        public int Number { get; set; } 
        public string Type { get; set; } //tipo de la casilla como puente oca carcel y to esas cosas
        public int Effect { get; set; }//efecto de la casilla pa lante pa atras y esas cozillas
    }
}

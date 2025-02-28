using JuegoOcaBack.Models.DTO;

namespace JuegoOcaBack.Models.Database.Entidades
{
    public class Board
    {
        public List<CellDTO> Cells { get; set; } = new List<CellDTO>();
        private Random _random = new Random();

        public Board()
        {
            InicializarTablero();
        }

        private void InicializarTablero()
        {
            for (int i = 1; i <= 63; i++)
            {
                var cell = new CellDTO { Number = i, Type = "Normal", Effect = 0 };

                // Casillas especiales
                if (i == 5 || i == 9 || i == 14 || i == 18 || i == 23 || i == 27 || i == 32
                    || i == 36 || i == 41 || i == 45 || i == 50 || i == 54 || i == 59 || i == 63) // Casillas de la oca
                {
                    cell.Type = "Oca";
                    cell.Effect = i + 1; // Avanza a la siguiente oca
                }
                else if (i == 6 || i == 12) // Puentes
                {
                    cell.Type = "Puente";
                    cell.Effect = i + 6; // Avanza 6 casillas
                }
                else if (i == 19) // Posada
                {
                    cell.Type = "Posada";
                    cell.Effect = -1; // Pierde un turno
                }
                else if (i == 26) // Dados
                {
                    cell.Type = "Dados";
                    cell.Effect = 53; // Te mueves a la casilla 53
                }
                else if (i == 31) // Pozo
                {
                    cell.Type = "Pozo";
                    int[] efectosPozo = { -1, 32 };
                    cell.Effect = efectosPozo[_random.Next(efectosPozo.Length)];
                }
                else if (i == 42) // Laberinto
                {
                    cell.Type = "Laberinto";
                    cell.Effect = -2; // Pierde un turno
                }
                else if (i == 52) // Cárcel
                {
                    cell.Type = "Carcel";
                    cell.Effect = -3; // Pierdes tres turnos
                }
                else if (i == 53) // Dados
                {
                    cell.Type = "Dados";
                    cell.Effect = 26; // Te mueves a la casilla 26
                }
                else if (i == 58) // Muerte
                {
                    cell.Type = "Muerte";
                    cell.Effect = 1; // Vuelve al inicio
                }

                Cells.Add(cell);
            }
        }
    }
}

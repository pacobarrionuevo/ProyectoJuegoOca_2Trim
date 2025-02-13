using JuegoOcaBack.Models.DTO;

namespace JuegoOcaBack.Models.Database.Entidades
{
    public class Board
    {
        public List<CellDTO> Cells { get; set; } = new List<CellDTO>();

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
                if (i % 9 == 0 && i != 63) // Casillas de la oca
                {
                    cell.Type = "Oca";
                    cell.Effect = i + 1; // Avanza a la siguiente oca
                }
                else if (i == 6 || i == 12) // Puentes
                {
                    cell.Type = "Puente";
                    cell.Effect = i + 6; // Avanza 6 casillas
                }
                else if (i == 19 || i == 31 || i == 42) // Posadas
                {
                    cell.Type = "Posada";
                    cell.Effect = -1; // Pierde un turno
                }
                else if (i == 58) // Muerte
                {
                    cell.Type = "Muerte";
                    cell.Effect = 0; // Vuelve al inicio
                }

                Cells.Add(cell);
            }
        }
    }
}

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
                if (i == 9 || i == 18 || i == 27 || i == 36 || i == 45 || i == 54 || i == 63) // Casillas de la oca
                {
                    cell.Type = "Oca";
                    cell.Effect = i + 5;
                }
                else if (i == 5 || i == 14 || i == 23 || i == 32 || i == 41 || i == 50 || i == 59)
                {
                    cell.Type = "Oca";
                    cell.Effect = i + 4;
                }
                else if (i == 6 ) // Puente1
                {
                    cell.Type = "Puente";
                    cell.Effect = 12;
                }
                else if (i == 12) // Puente2
                {
                    cell.Type = "Puente";
                    cell.Effect = 6;
                }
                else if (i == 19) // Posada
                {
                    cell.Type = "Posada";
                    cell.Effect = i; 
                }
                else if (i == 26) // Dados
                {
                    cell.Type = "Dados";
                    cell.Effect = 53; 
                }
                else if (i == 31) // Pozo
                {
                    cell.Type = "Pozo";
                    cell.Effect = i;
                }
                else if (i == 42) // Laberinto
                {
                    cell.Type = "Laberinto";
                    cell.Effect = i;
                }
                else if (i == 52) // Cárcel
                {
                    cell.Type = "Carcel";
                    cell.Effect = i; 
                }
                else if (i == 53) // Dados
                {
                    cell.Type = "Dados";
                    cell.Effect = 26;
                }
                else if (i == 58) // Muerte
                {
                    cell.Type = "Muerte";
                    cell.Effect = 1; 
                }
                else if (i == 1)
                {
                    cell.Type = "Inicio";
                    cell.Effect = i;
                }
                else if (i == 2 || i == 3 || i == 4 || i == 28 || i == 29 || i == 30 || i == 47 || i == 48 || i == 49 || i == 60)
                {
                    cell.Type = "FlechaDerecha";
                    cell.Effect = i;
                }
                else if (i == 7 || i == 8 || i == 10 || i == 11 || i == 13 || i == 33 || i == 34 || i == 35 || i == 37|| i == 51 || i == 61)
                {
                    cell.Type = "FlechaArriba";
                    cell.Effect = i;
                }
                else if (i == 15 || i == 16 || i == 17 || i == 20 || i == 39 || i == 40 || i == 55 || i == 56 || i == 62)
                {
                    cell.Type = "FlechaIzquierda";
                    cell.Effect = i;
                }
                else if (i == 22 || i == 24 || i == 25 || i == 44 || i == 46 || i == 57)
                {
                    cell.Type = "FlechaAbajo";
                    cell.Effect = i;
                }
                Cells.Add(cell);
            }
        }
    }
}

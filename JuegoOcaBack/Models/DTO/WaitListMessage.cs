namespace JuegoOcaBack.Models.DTO
{
    public record WaitlistMessage(
    string type,
    int playersInQueue,
    int totalPlayers
);
}

namespace JuegoOcaBack.Models.DTO
{
    public record GameReadyMessage(
        string Type,
        string GameId,
        int OpponentId
    );
}
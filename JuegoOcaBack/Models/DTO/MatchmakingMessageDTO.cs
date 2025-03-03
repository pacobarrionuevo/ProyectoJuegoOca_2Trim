namespace JuegoOcaBack.Models.DTO
{
    public class MatchmakingMessageDTO
    {
        public string Type { get; set; }
        public int FriendId { get; set; }
        public int HostId { get; set; }
        public string RoomId { get; set; }
    }
}

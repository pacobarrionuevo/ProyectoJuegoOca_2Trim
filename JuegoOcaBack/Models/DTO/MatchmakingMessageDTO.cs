namespace JuegoOcaBack.Models.DTO
{
    public class MatchmakingMessageDTO
    {
        public string Type { get; set; } // Tipo de mensaje (inviteFriend, acceptInvitation, playWithBot, playRandom)
        public int FriendId { get; set; } // ID del amigo (para invitaciones)
        public int HostId { get; set; }
    }
}

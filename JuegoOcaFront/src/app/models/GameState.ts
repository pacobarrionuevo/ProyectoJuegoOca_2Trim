interface GameState {
    gameId: string;
    players: Array<{
      id: number;
      name: string;
      position: number;
      isBot?: boolean;
      turnsToSkip?: number;
    }>;
    currentPlayer: {
      id: number;
      name: string;
    };
    diceResult?: number;
  }
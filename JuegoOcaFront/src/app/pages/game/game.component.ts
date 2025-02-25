import { Component, OnInit } from '@angular/core';
import { GameService } from '../../services/game.service';

@Component({
  selector: 'app-game',
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.css']
})
export class GameComponent implements OnInit {
  players: any[] = [];
  currentPlayer: any;
  diceResult: number | null = null;

  constructor(private gameService: GameService) {}

  ngOnInit(): void {
    // Suscribirse a las actualizaciones del estado del juego
    this.gameService.gameStateUpdated.subscribe((state: any) => {
      this.players = state.players;
      this.currentPlayer = state.currentPlayer;
      this.diceResult = state.diceResult;
    });

    // Iniciar la partida (ejemplo)
    this.gameService.startGame('12345'); // Reemplaza '12345' con el ID real de la partida
  }

  rollDice(): void {
    this.gameService.rollDice();
  }
}
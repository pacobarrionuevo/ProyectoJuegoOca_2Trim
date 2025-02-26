import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { WebsocketService } from '../../services/websocket.service';

@Component({
  selector: 'app-game',
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.css']
})
export class GameComponent implements OnInit {
  gameId!: string;
  isPrivate: boolean = false;
  opponentId!: number;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private webSocketService: WebsocketService
  ) { }

  ngOnInit(): void {
    const state = history.state;
    this.gameId = this.route.snapshot.paramMap.get('id') || '';
    
    if (state) {
      this.isPrivate = state.isPrivate || false;
      this.opponentId = state.opponentId;
    }

    this.initGameWebSocket();
  }

  private initGameWebSocket(): void {
    this.webSocketService.sendRxjs(JSON.stringify({
      type: 'joinGame',
      gameId: this.gameId,
      isPrivate: this.isPrivate
    }));

    this.webSocketService.messageReceived.subscribe(message => {
      if (message.gameId === this.gameId) {
        this.handleGameUpdate(message);
      }
    });
  }

  private handleGameUpdate(message: any): void {
    switch (message.type) {
      case 'playerJoined':
        console.log('Jugador unido:', message.playerId);
        break;
      case 'gameStart':
        console.log('La partida ha comenzado');
        break;
      case 'gameEnd':
        this.handleGameEnd(message);
        break;
    }
  }

  private handleGameEnd(message: any): void {
    console.log('La partida ha terminado. Resultado:', message.result);
    this.router.navigate(['/menu']);
  }
}
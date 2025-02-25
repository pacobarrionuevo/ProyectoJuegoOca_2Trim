import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-game',
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.css']
})
export class GameComponent implements OnInit {
  gameId: string | null = null;
  opponentId: number | null = null;

  constructor(private router: Router) {}

  ngOnInit(): void {
    // Obtener el gameId y opponentId del estado de la navegación
    const state = this.router.getCurrentNavigation()?.extras.state;
    if (state && state['gameId'] && state['opponentId']) {
      this.gameId = state['gameId'];
      this.opponentId = state['opponentId'];
      console.log('Partida iniciada con ID:', this.gameId, 'contra el oponente:', this.opponentId);
    } else {
      console.error('No se encontraron datos de la partida.');
      this.router.navigate(['/menu']); // Redirigir si no hay datos
    }
  }
}
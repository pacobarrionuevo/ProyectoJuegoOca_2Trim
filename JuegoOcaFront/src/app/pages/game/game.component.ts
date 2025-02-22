import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-game',
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.css']
})
export class GameComponent implements OnInit {
  gameId: string | null = null;

  constructor(private router: Router) {}

  ngOnInit(): void {
    // Obtener el gameId del estado de la navegación
    const state = this.router.getCurrentNavigation()?.extras.state;
    if (state && state['gameId']) {
      this.gameId = state['gameId'];
      console.log('Partida iniciada con ID:', this.gameId);
    } else {
      console.error('No se encontró el ID de la partida.');
    }
  }
}
import { Component, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { WebsocketService } from '../../services/websocket.service';

@Component({
  selector: 'app-matchmaking',
  template: `
    <div class="status">
      <p *ngIf="estado === 'buscando'">
        Buscando oponente... Jugadores en cola: {{ jugadoresEnCola }}
      </p>
      <button (click)="cancelarBusqueda()" *ngIf="estado === 'buscando'">
        Cancelar
      </button>
    </div>
  `,
  styleUrls: ['./matchmaking.component.css']
})
export class MatchmakingComponent implements OnDestroy {
  estado: 'inactivo' | 'buscando' | 'enPartida' = 'inactivo';
  jugadoresEnCola = 0;

  constructor(
    private wsService: WebsocketService,
    private router: Router
  ) {
    this.wsService.messageReceived.subscribe((msg: any) => {
      if (msg.type === 'gameReady') {
        this.estado = 'enPartida';
        setTimeout(() => {
          this.router.navigate(['/game'], { 
            state: { gameId: msg.gameId, opponentId: msg.opponentId }
          });
        }, 3000);
      } else if (msg.type === 'waitingStatus') {
        this.jugadoresEnCola = msg.playersInQueue;
      }
    });
  }

  buscarPartida() {
    this.estado = 'buscando';
    this.wsService.sendRxjs(JSON.stringify({ type: 'playRandom' }));
  }

  cancelarBusqueda() {
    this.estado = 'inactivo';
    this.wsService.sendRxjs(JSON.stringify({ type: 'cancelSearch' }));
  }

  ngOnDestroy() {
    this.cancelarBusqueda();
  }
}
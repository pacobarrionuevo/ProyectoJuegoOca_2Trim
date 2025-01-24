import { Component, OnDestroy, OnInit } from '@angular/core';
import { WebsocketService } from '../../services/websocket.service';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-websocket',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './websocket.component.html',
  styleUrl: './websocket.component.css'
})
export class WebsocketComponent implements OnInit, OnDestroy {

  message: string = '';
  serverResponse: string = '';
  isConnected: boolean = false;
  connected$: Subscription;
  messageReceived$: Subscription;
  disconnected$: Subscription;
  type: 'native' | 'rxjs';

  constructor(private webSocketService: WebsocketService) { }

  ngOnInit(): void {
    this.connected$ = this.webSocketService.connected.subscribe(() => this.isConnected = true);
    this.messageReceived$ = this.webSocketService.messageReceived.subscribe(message => this.serverResponse = message);
    this.disconnected$ = this.webSocketService.disconnected.subscribe(() => this.isConnected = false);
  }

  connectNative() {
    this.type = 'native';
    this.webSocketService.connectNative();
  }

  connectRxjs() {
    this.type = 'rxjs';
    this.webSocketService.connectRxjs();
  }

  send() {
    switch (this.type) {
      case 'native':
        this.webSocketService.sendNative(this.message);
        break;

      default:
        this.webSocketService.sendRxjs(this.message);
    }
  }

  disconnect() {
    switch (this.type) {
      case 'native':
        this.webSocketService.disconnectNative();
        break;

      default:
        this.webSocketService.disconnectRxjs();
    }
  }

  ngOnDestroy(): void {
    this.connected$.unsubscribe();
    this.messageReceived$.unsubscribe();
    this.disconnected$.unsubscribe();
  }
}

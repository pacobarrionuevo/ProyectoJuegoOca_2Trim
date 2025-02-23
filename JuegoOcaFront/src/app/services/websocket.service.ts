import { Injectable } from '@angular/core';
import { Subject, BehaviorSubject  } from 'rxjs';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';

@Injectable({
  providedIn: 'root'
})
export class WebsocketService {
  private socket: WebSocket | null = null;
  private socket$: WebSocketSubject<string> | null = null;
  private isManuallyDisconnected = false;
  public isConnectedSubject = new BehaviorSubject<boolean>(false); 

  connected = new Subject<void>();
  messageReceived = new Subject<any>();
  disconnected = new Subject<void>();

  private tokenKey = 'websocket_token';

  constructor() {  }

  private onConnected() {
    console.log('✅ Evento: WebSocket conectado');
    this.isConnectedSubject.next(true);
    this.connected.next();
}


  private onMessageReceived(message: string) {
    try {
      const parsedMessage = JSON.parse(message);
      this.messageReceived.next(parsedMessage);
    } catch (error) {
      console.error('Error al parsear mensaje:', error);
    }
  }

  private onError(error: any) {
    console.error('Error en WebSocket:', error);
  }

  private onDisconnected() {
    console.log('🔴 Evento: WebSocket desconectado');
    this.isConnectedSubject.next(false);
    this.disconnected.next();

    if (!this.isManuallyDisconnected) {
        console.log('🔁 Intentando reconectar en 3 segundos...');
    }
}


  connectRxjs(token: string) {
    if (this.socket$ && !this.socket$.closed) {
        console.log('❌ Ya hay una conexión WebSocket activa.');
        return; // Evita conexiones múltiples
    }

    console.log('🔌 Conectando a WebSocket con token:', token);

    this.isManuallyDisconnected = false; 
    this.socket$ = webSocket({
        url: `wss://localhost:7077/ws/connect?token=${token}`,
        openObserver: { next: () => {
            console.log('✅ WebSocket conectado.');
            this.onConnected();
        }},
        serializer: (value: string) => value,
        deserializer: (event: MessageEvent) => event.data
    });

    this.socket$.subscribe({
        next: (message: string) => {
            console.log('📩 Mensaje recibido:', message);
            this.onMessageReceived(message);
        },
        error: (error) => {
            console.error('❗ Error en WebSocket:', error);
            this.onError(error);
        },
        complete: () => {
            console.log('🔴 WebSocket desconectado.');
            this.onDisconnected();
        }
    });

    window.addEventListener('beforeunload', () => {
        console.log('🚪 Cerrando WebSocket antes de salir de la página.');
        this.disconnectRxjs();
    });
}


  isConnectedRxjs(): boolean {
    return this.isConnectedSubject.value;
  }

  sendRxjs(message: string) {
    if (this.socket$ && !this.socket$.closed) {
      this.socket$.next(message);
    }
  }

  disconnectRxjs(): void {
    if (this.socket$ && !this.socket$.closed) {
      this.isManuallyDisconnected = true;
      this.socket$.complete(); // Cerrar WebSocket correctamente
      this.isConnectedSubject.next(false);
    }
  }


  closeConnection() {
    if (this.socket) {
      console.log("🚪 Cerrando WebSocket...");
      this.socket.close();
      this.socket = null;
    }
  }
}

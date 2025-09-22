export const WEBSOCKET_URL = import.meta.env.VITE_WEBSOCKET_URL;

export class GameWebSocket {
  private socket: WebSocket;
  private onMessageCallback: (msg: any) => void;

  constructor(onMessage: (msg: any) => void) {
    this.onMessageCallback = onMessage;
    this.socket = new WebSocket(WEBSOCKET_URL);

    this.socket.onopen = () => console.log("Connected to WebSocket");
    this.socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.onMessageCallback(data);
    };
    this.socket.onclose = () => console.log("Disconnected from WebSocket");
  }

  send(action: string, payload: Record<string, any>) {
    this.socket.send(JSON.stringify({ action, ...payload }));
  }

  close() {
    this.socket.close();
  }
}

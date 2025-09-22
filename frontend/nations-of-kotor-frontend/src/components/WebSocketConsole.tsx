import { useEffect, useState } from "react";
import { GameWebSocket } from "../api/websocket";

export default function WebSocketConsole() {
  const [messages, setMessages] = useState<string[]>([]);
  const [client, setClient] = useState<GameWebSocket | null>(null);

  useEffect(() => {
    const ws = new GameWebSocket((msg) => {
      setMessages((prev) => [...prev, JSON.stringify(msg)]);
    });
    setClient(ws);

    return () => {
      ws.close();
    };
  }, []);

  const sendTestMessage = () => {
    client?.send("sendMessage", { message: "Hello from frontend!" });
  };

  return (
    <div className="p-4 border rounded-xl shadow-md max-w-md mx-auto bg-white mt-6">
      <h2 className="text-xl font-bold mb-2">WebSocket Console</h2>
      <button
        onClick={sendTestMessage}
        className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
      >
        Send Test Message
      </button>
      <div className="mt-4 max-h-40 overflow-y-auto bg-gray-100 p-2 rounded">
        {messages.map((msg, i) => (
          <div key={i} className="text-sm font-mono">
            {msg}
          </div>
        ))}
      </div>
    </div>
  );
}

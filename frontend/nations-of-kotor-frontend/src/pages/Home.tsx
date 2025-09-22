import TaskCreator from "../components/TaskCreator";
import WebSocketConsole from "../components/WebSocketConsole";

export default function Home() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold text-center">Nations of Kotor</h1>
      <TaskCreator />
      <WebSocketConsole />
    </div>
  );
}

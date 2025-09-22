import { useState } from "react";
import { createTask } from "../api/http";

export default function TaskCreator() {
  const [taskName, setTaskName] = useState("");
  const [status, setStatus] = useState("");

  const handleCreateTask = async () => {
    try {
      const result = await createTask(taskName);
      setStatus(`Task created: ${JSON.stringify(result)}`);
    } catch (error: any) {
      setStatus(`Error: ${error.message}`);
    }
  };

  return (
    <div className="p-4 border rounded-xl shadow-md max-w-md mx-auto bg-white">
      <h2 className="text-xl font-bold mb-2">Create Task</h2>
      <input
        type="text"
        placeholder="Task name"
        value={taskName}
        onChange={(e) => setTaskName(e.target.value)}
        className="border rounded p-2 w-full mb-2"
      />
      <button
        onClick={handleCreateTask}
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
      >
        Create Task
      </button>
      {status && <p className="mt-2 text-gray-700">{status}</p>}
    </div>
  );
}

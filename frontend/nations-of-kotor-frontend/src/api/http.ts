export const HTTP_API_URL = import.meta.env.VITE_HTTP_API_URL;

export async function createTask(taskName: string) {
    const response = await fetch(`${HTTP_API_URL}/create-task`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            type: taskName,
            ownerId: "user1",
            nationId: "n1",
            durationSeconds: 30,
            params: {}
        }),
    });

    if (!response.ok) {
        throw new Error(`Failed to create task: ${response.statusText}`);
    }

    return response.json();
}
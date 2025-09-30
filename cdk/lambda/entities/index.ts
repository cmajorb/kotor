import { EntityService } from "./EntityService";
import { GetEntitiesResponse } from "./types";

export const handler = async () => {
  try {
    const entities = await EntityService.getAllEntities();

    const response: GetEntitiesResponse = { entities };

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*", // CORS
      },
      body: JSON.stringify(response),
    };
  } catch (err: any) {
    console.error("Error fetching entities:", err);

    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to fetch entity definitions" }),
    };
  }
};
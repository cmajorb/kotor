import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE || "ConnectionsTable";
const WS_API_ID = process.env.WS_API_ID!;
const WS_STAGE = process.env.WS_STAGE || "prod";
const AWS_REGION = process.env.AWS_REGION || "us-east-1";
import type { Entity, Task, EntityDefinition } from "../entities/types";
import { EntityService } from "../entities/EntityService";

const apiGwEndpoint = `https://${WS_API_ID}.execute-api.${AWS_REGION}.amazonaws.com/${WS_STAGE}`;
const apigw = new ApiGatewayManagementApiClient({ endpoint: apiGwEndpoint });
let cachedDefinitionMap: Map<string, EntityDefinition> | null = null;

async function getDefinitionMap(): Promise<Map<string, EntityDefinition>> {
    // Cache across Lambda invocations to avoid repeated fetching
    if (!cachedDefinitionMap) {
        const allDefinitions = await EntityService.getAllEntities();
        cachedDefinitionMap = new Map(allDefinitions.map(def => [def.id, def]));
    }
    return cachedDefinitionMap;
}

export const handler = async (event: any) => {
  // Scheduler passes payload as body with taskId
  const task = typeof event === "string" ? JSON.parse(event) as Task : event.detail as Task || event as Task;

  if (!task.id) {
    console.warn("No taskId in event", event);
    return;
  }

  console.log("Finalizing task", task.id);

  if (task.status === "COMPLETE") {
    console.log("Task already complete", task.id);
    return;
  }

  // Apply task-specific logic
  switch (task.type) {
    case "build":
      await handleConstructionTask(task);
      break;
    case "generate":
      await handleResourceTask(task);
      break;
    case "move":
      await handleTroopMovementTask(task);
      break;
    default:
      console.warn("Unknown task type", task.type);
      break;
  }

  console.log("Task completed", task.id);
  
};

async function handleConstructionTask(task: Task) {
  console.log("Completing construction:", task);
  await ddb.send(new UpdateCommand({
    TableName: process.env.TILES_TABLE,
    Key: { regionId: task.entity.regionId, entityKey: task.entity.entityKey },
    UpdateExpression: "SET params.constructionStatus = :complete",
    ExpressionAttributeValues: {
      ":complete": "COMPLETE"
    }
  }));
  task.entity.params.constructionStatus = "COMPLETE";
  await broadcastTaskCompletion(task);
}

async function handleResourceTask(task: Task) {
  console.log("Applying resource generation:", task.id);
  // Example: add resources to player/nation
}

async function handleTroopMovementTask(task: Task) {
  console.log("Completing troop movement:", task.id);
  // Example: update unit position in map
}

async function broadcastTaskCompletion(task: Task) {
  const scanResp: any = await ddb.send(new ScanCommand({ TableName: CONNECTIONS_TABLE }));

  const definitionMap = await getDefinitionMap();

  const message = JSON.stringify({
    action: "ENTITY_UPDATED",
    changeType: "MODIFY",
    entity: EntityService.mapEntityRequestToEntity(task.entity, definitionMap)
  });

  if (!scanResp.Items) return;

  for (const item of scanResp.Items) {
    const connectionId = item.connectionId?.S || item.connectionId;
    if (!connectionId) continue;

    try {
      await apigw.send(new PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: Buffer.from(message)
      }));
      console.log("Sent WebSocket message to", connectionId);
    } catch (err: any) {
      if (err.name === "GoneException") {
        console.log("Connection gone, should delete", connectionId);
        // Optionally remove stale connection from table
      } else {
        console.error("Failed to send WebSocket message:", err);
      }
    }
  }
}

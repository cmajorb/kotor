import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TASKS_TABLE = process.env.TASKS_TABLE || 'ProductionTasksTable';
const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE || 'ConnectionsTable';
const WS_API_ID = process.env.WS_API_ID;
const WS_STAGE = process.env.WS_STAGE || 'prod';

const apiGwEndpoint = `https://${WS_API_ID}.execute-api.${process.env.AWS_REGION}.amazonaws.com/${WS_STAGE}`;
const apigw = new ApiGatewayManagementApiClient({ endpoint: apiGwEndpoint });

export const handler = async (event: any) => {
  // Scheduler passes payload as body with taskId
  const body = typeof event === 'string' ? JSON.parse(event) : (event as any).detail || event;
  const taskId = body.taskId || (body?.payload && JSON.parse(body.payload).taskId);

  if (!taskId) {
    console.log('No taskId in event', event);
    return;
  }

  // Fetch task
  const resp = await ddb.send(new GetCommand({
    TableName: TASKS_TABLE,
    Key: { taskId } 
  }));

  const task = resp.Item;
  if (!task) {
    console.log('Task not found', taskId);
    return;
  }

  if (task.status === 'COMPLETE') {
    console.log('Already complete', taskId);
    return;
  }

  // TODO: apply game logic: give resources, move unit, etc. For MVP we'll mark COMPLETE.
  await ddb.send(new UpdateCommand({
    TableName: TASKS_TABLE,
    Key: { taskId },
    UpdateExpression: 'SET #s = :s, completedAt = :t',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: { ':s': 'COMPLETE', ':t': Math.floor(Date.now() / 1000) }
  }));

  // Broadcast to all connections (naive: scan table)
  // In production use a GSI to query by nation and lookup only relevant connections.
  const { ScanCommand } = await import('@aws-sdk/lib-dynamodb');
  // For simplicity we'll use low-level DynamoDB client to scan connections
  const ddbLow = new (await import('@aws-sdk/client-dynamodb')).DynamoDBClient({});
  const { ScanCommand: Scan } = await import('@aws-sdk/client-dynamodb');
  const scanResp: any = await ddbLow.send(new Scan({ TableName: CONNECTIONS_TABLE }));

  const message = JSON.stringify({
    type: 'taskComplete',
    taskId,
    result: { status: 'COMPLETE', taskId }
  });

  if (scanResp.Items) {
    for (const item of scanResp.Items) {
      const connectionId = item.connectionId?.S || item.connectionId;
      if (!connectionId) continue;
      try {
        await apigw.send(new PostToConnectionCommand({
          ConnectionId: connectionId,
          Data: Buffer.from(message)
        }));
      } catch (err: any) {
        // If broken connection, optionally remove from table
        if (err.name === 'GoneException') {
          // delete logic (omitted for brevity)
        }
      }
    }
  }

  console.log('Finalized task', taskId);
};

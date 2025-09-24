import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);
const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE || 'ConnectionsTable';

export const handler = async (event: any) => {
  // event.requestContext.connectionId is the WebSocket connection id
  const connectionId = event.requestContext?.connectionId;
  const regionId = event.queryStringParameters?.regionId || "world";
  // We could validate a JWT from queryStringParameters.Authorization or subprotocol, but keeping simple
  const userId = event.queryStringParameters?.userId || 'anonymous';

  if (!connectionId) {
    return { statusCode: 400, body: 'no connection' };
  }

  // Save connection record
  await ddb.send(new PutCommand({
    TableName: CONNECTIONS_TABLE,
    Item: {
      connectionId,
      userId,
      regionId,
      connectedAt: Date.now()
    }
  }));

  return { statusCode: 200, body: 'connected' };
};

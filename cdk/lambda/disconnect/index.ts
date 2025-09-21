import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, DeleteCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);
const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE || 'ConnectionsTable';

export const handler = async (event:any) => {
  const connectionId = event.requestContext?.connectionId;
  if (connectionId) {
    await ddb.send(new DeleteCommand({
      TableName: CONNECTIONS_TABLE,
      Key: { connectionId }
    }));
  }
  return { statusCode: 200, body: 'disconnected' };
};

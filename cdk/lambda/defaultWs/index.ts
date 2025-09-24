import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const { CONNECTIONS_TABLE } = process.env;

export const handler = async (event: any) => {
  console.log("Received WebSocket message:", JSON.stringify(event));

  const { requestContext, body } = event;
  const connectionId = requestContext.connectionId;
  const data = body ? JSON.parse(body) : {};

  try {
    const action = data.action;

    if (action === "SUBSCRIBE_REGION") {
      const regionId = data.regionId;

      if (!regionId) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: "regionId is required" }),
        };
      }

      // Save connectionId -> regionId mapping in DynamoDB
      await ddb.send(
        new PutCommand({
          TableName: CONNECTIONS_TABLE!,
          Item: {
            connectionId,
            regionId,
            timestamp: Date.now(),
          },
        })
      );

      console.log(`Connection ${connectionId} subscribed to region ${regionId}`);

      return {
        statusCode: 200,
        body: JSON.stringify({ message: `Subscribed to region ${regionId}` }),
      };
    }

    // Default action: echo message back or log it
    console.log("Unknown or unsupported action:", action);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Action received", action }),
    };
  } catch (err: any) {
    console.error("Error handling WebSocket message:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};

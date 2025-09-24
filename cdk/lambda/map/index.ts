import { DeleteItemCommand, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";
import { v4 as uuidv4 } from "uuid";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const { TILES_TABLE, CONNECTIONS_TABLE, WS_API_ID, WS_STAGE, AWS_REGION } = process.env;


const wsClient = new ApiGatewayManagementApiClient({
    endpoint: `https://${WS_API_ID}.execute-api.${AWS_REGION}.amazonaws.com/${WS_STAGE}`
});

export const handler = async (event: any) => {
    const method = event.httpMethod;
    const path = event.path;
    console.log("Establisehd connection to API Gateway Management API at", `https://${WS_API_ID}.execute-api.${AWS_REGION}.amazonaws.com/${WS_STAGE}`);

    try {
        if (method === "GET" && path === "/map") {
            return await handleGetMap(event);
        } else if (method === "POST" && path === "/map/entity") {
            return await handleCreateEntity(event);
        } else {
            return {
                statusCode: 404,
                body: JSON.stringify({ message: "Not found" })
            };
        }
    } catch (err: any) {
        console.error("Error handling request", err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: err.message })
        };
    }
};


async function handleGetMap(event: any) {
    const regionId = event.queryStringParameters?.regionId;

    if (!regionId) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: "regionId is required" }),
        };
    }

    const resp = await ddb.send(new QueryCommand({
        TableName: TILES_TABLE,
        KeyConditionExpression: "regionId = :r",
        ExpressionAttributeValues: {
            ":r": regionId
        }
    }));

    return {
        statusCode: 200,
        body: JSON.stringify(resp.Items || []),
    };
}

async function handleCreateEntity(event: any) {
    const body = JSON.parse(event.body || "{}");
    const { regionId, entityType, x, y, width, height, ownerId, data } = body;

    if (!regionId || !entityType || x === undefined || y === undefined) {
        return {
            statusCode: 400,
            body: JSON.stringify({ message: "regionId, entityType, x, and y are required" })
        };
    }

    const entityId = uuidv4();
    const entityKey = `${entityType}#${x}_${y}#${entityId}`;

    const item = {
        regionId,
        entityKey,
        entityType,
        x,
        y,
        width,
        height,
        ownerId,
        data
    };

    await ddb.send(new PutCommand({
        TableName: TILES_TABLE,
        Item: item
    }));

    // 2. Broadcast to all connections watching this region
    await broadcastRegionUpdate(regionId, {
        action: "ENTITY_UPDATED",
        changeType: "INSERT",
        entity: {
            regionId,
            entityKey,
            entityType,
            x,
            y,
            width,
            height,
            ownerId,
            data
        }
    });

    return {
        statusCode: 201,
        body: JSON.stringify({ entityKey, regionId })
    };
}


async function broadcastRegionUpdate(regionId: string, message: any) {
    // Find all connections watching this region
    console.log("Broadcasting to region", regionId);
    const result = await ddb.send(new QueryCommand({
        TableName: CONNECTIONS_TABLE,
        KeyConditionExpression: "regionId = :regionId",
        ExpressionAttributeValues: {
            ":regionId": regionId
        },
        IndexName: "RegionIndex" // Make sure you create this GSI
    }));

    if (!result.Items || result.Items.length === 0) return;

    const payload = JSON.stringify(message);

    await Promise.all(result.Items.map(async (conn) => {
        const connectionId = conn.connectionId;
        console.log("Sending to connection", connectionId, payload);
        try {
            await wsClient.send(new PostToConnectionCommand({
                ConnectionId: connectionId,
                Data: Buffer.from(payload)
            }));
        } catch (err: any) {
            console.error("Failed to send to connection", connectionId, err);
            if (err.statusCode === 410) {
                // Stale connection, clean it up
                await ddb.send(new DeleteItemCommand({
                    TableName: CONNECTIONS_TABLE,
                    Key: { connectionId: { S: connectionId } }
                }));
            }
        }
    }));
}
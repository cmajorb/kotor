import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE_NAME = process.env.GAME_STATE_TABLE;

export const handler = async (event: any) => {
    const method = event.httpMethod;
    const path = event.path;

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
        TableName: TABLE_NAME,
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
    const { regionId, entityType, x, y, ownerId, data } = body;

    if (!regionId || !entityType || x === undefined || y === undefined) {
        return {
            statusCode: 400,
            body: JSON.stringify({ message: "regionId, tileType, type, and ownerId are required" })
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
        ownerId,
        data
    };

    await ddb.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: item
    }));

    return {
        statusCode: 201,
        body: JSON.stringify({ entityKey, regionId })
    };
}

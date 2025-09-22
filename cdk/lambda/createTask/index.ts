import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { SchedulerClient, CreateScheduleCommand } from "@aws-sdk/client-scheduler";
import { v4 as uuidv4 } from 'uuid';

const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);
const schedulerClient = new SchedulerClient({});

const TASKS_TABLE = process.env.TASKS_TABLE || 'ProductionTasksTable';
const SCHEDULER_ROLE_ARN = process.env.SCHEDULER_ROLE_ARN; // set in CDK
const FINALIZER_ARN = process.env.FINALIZER_ARN;

export const handler = async (event: any) => {
  const body = JSON.parse(event.body || '{}');
  // Expecting: { type: 'produce', ownerId: 'user1', nationId: 'n1', durationSeconds: 60, params: {...} }
  const { type, ownerId, nationId, durationSeconds = 60, params = {} } = body;

  const taskId = uuidv4();
  const now = Math.floor(Date.now() / 1000);
  const endsAt = now + durationSeconds;

  const item = {
    taskId,
    type,
    ownerId,
    nationId,
    startedAt: now,
    endsAt,
    status: 'SCHEDULED',
    params
  };

  // Put into DynamoDB
  await ddb.send(new PutCommand({
    TableName: TASKS_TABLE,
    Item: item
  }));

  // Create a one-off schedule in EventBridge Scheduler to invoke the FinalizeTask Lambda at the endsAt timestamp.
  // We'll give the schedule a name containing taskId
  const scheduleName = `finalize-${taskId}`;
  const payload = JSON.stringify({ taskId, endsAt });

  const endsAtDate = new Date(endsAt * 1000);
  const isoString = endsAtDate.toISOString().split('.')[0];
  const createCmd = new CreateScheduleCommand({
    Name: scheduleName,
    ScheduleExpression: `at(${isoString})`,
    FlexibleTimeWindow: { Mode: 'OFF' },
    Target: {
      Arn: FINALIZER_ARN,
      RoleArn: SCHEDULER_ROLE_ARN,
      Input: payload,
      DeadLetterConfig: {
        Arn: process.env.SCHEDULER_DLQ_ARN
      },
      RetryPolicy: {
        MaximumRetryAttempts: 2,
        MaximumEventAgeInSeconds: 3600,
      }
      // Use retry policy etc if desired
    }
  });

  await schedulerClient.send(createCmd);

  return {
    statusCode: 200,
    body: JSON.stringify({ taskId, endsAt })
  };
};

import { SchedulerClient, CreateScheduleCommand } from "@aws-sdk/client-scheduler";
import { v4 as uuidv4 } from 'uuid';
import { Task, EntityRequest } from "../entities/types";

const schedulerClient = new SchedulerClient({});

const SCHEDULER_ROLE_ARN = process.env.SCHEDULER_ROLE_ARN; // set in CDK
const FINALIZER_ARN = process.env.FINALIZER_ARN;

export const handler = async (event: any) => {
  const request = JSON.parse(event.body || '{}') as EntityRequest;
  console.log("Received createTask event:", request);

  const taskId = uuidv4();
  const now = Math.floor(Date.now() / 1000);
  const endsAt = now + 60; // For demo purposes, set to 60 seconds from now

  const item = {
    id: taskId,
    entity: request,
    type: 'build',
    status: 'IN_PROGRESS',
  } as Task;
  console.log(item);

  // Create a one-off schedule in EventBridge Scheduler to invoke the FinalizeTask Lambda at the endsAt timestamp.
  // We'll give the schedule a name containing taskId
  const scheduleName = `finalize-${taskId}`;
  const payload = JSON.stringify(item);

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

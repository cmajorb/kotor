// bin/kotor.ts
import * as cdk from 'aws-cdk-lib';
import { DatabaseStack } from '../stacks/DatabaseStack';
import { AuthStack } from '../stacks/AuthStack';
import { StorageStack } from '../stacks/StorageStack';
import { WebSocketApiStack } from '../stacks/WebSocketApiStack';
import { HttpApiStack } from '../stacks/HttpApiStack';
import { SchedulerStack } from '../stacks/SchedulerStack';

const app = new cdk.App();

const dbStack = new DatabaseStack(app, 'DatabaseStack');
new AuthStack(app, 'AuthStack');
new StorageStack(app, 'StorageStack');

const wsStack = new WebSocketApiStack(app, 'WebSocketStack', {
  connectionsTable: dbStack.connectionsTable
});

const schedulerStack = new SchedulerStack(app, 'SchedulerStack', {
  tasksTable: dbStack.tasksTable,
  tilesTable: dbStack.tilesTable,
  connectionsTable: dbStack.connectionsTable,
  wsApi: wsStack.wsApi,
  wsStage: wsStack.wsStage,
});

new HttpApiStack(app, 'HttpApiStack', {
  connectionsTable: dbStack.connectionsTable,
  tilesTable: dbStack.tilesTable,
  wsApi: wsStack.wsApi,
  wsStage: wsStack.wsStage,
  schedulerRoleArn: schedulerStack.schedulerRoleArn,
  finalizeTaskFnArn: schedulerStack.finalizeTaskFnArn,
  schedulerDlqArn: schedulerStack.schedulerDlqArn
});



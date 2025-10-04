// stacks/SchedulerStack.ts
import * as cdk from 'aws-cdk-lib';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { mkLambda } from '../constructs/LambdaFactory';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';

interface SchedulerStackProps extends cdk.StackProps {
  tasksTable: dynamodb.Table;
  tilesTable: dynamodb.Table;
  connectionsTable: dynamodb.Table;
  wsApi: apigwv2.CfnApi;
  wsStage: apigwv2.CfnStage;
}

export class SchedulerStack extends cdk.Stack {
  public readonly schedulerRoleArn: string;
  public readonly finalizeTaskFnArn: string;
  public readonly schedulerDlqArn: string;
  constructor(scope: Construct, id: string, props: SchedulerStackProps) {
    super(scope, id, props);

    const { tasksTable, tilesTable, connectionsTable, wsApi, wsStage } = props;

    const finalizeTaskFn = mkLambda(this, 'FinalizeTaskFn', 'finalizeTask', {
      CONNECTIONS_TABLE: connectionsTable.tableName,
      TILES_TABLE: tilesTable.tableName,
      WS_API_ID: wsApi.ref,
      WS_STAGE: wsStage.stageName || 'prod'
    });
    this.finalizeTaskFnArn = finalizeTaskFn.functionArn;
    tasksTable.grantReadWriteData(finalizeTaskFn);
    tilesTable.grantReadWriteData(finalizeTaskFn);
    connectionsTable.grantReadWriteData(finalizeTaskFn);

    const manageConnectionsPolicy = new iam.PolicyStatement({
      actions: ['execute-api:ManageConnections'],
      resources: [`*`]
    });


    finalizeTaskFn.addToRolePolicy(manageConnectionsPolicy);

    const schedulerRole = new iam.Role(this, 'EventBridgeSchedulerRole', {
      assumedBy: new iam.ServicePrincipal('scheduler.amazonaws.com'),
    });
    schedulerRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['lambda:InvokeFunction'],
      resources: [finalizeTaskFn.functionArn],
    }));

    this.schedulerRoleArn = schedulerRole.roleArn;

    // Grant CreateTask Lambda permission to pass the role to scheduler when creating schedules (we will create an IAM role below)
    // Create an IAM role which Scheduler will assume to invoke the Lambda finalizer
    const schedulerInvokeRole = new iam.Role(this, 'SchedulerInvokeRole', {
      assumedBy: new iam.ServicePrincipal('scheduler.amazonaws.com'),
      inlinePolicies: {
        invokeFinalizer: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: ['lambda:InvokeFunction'],
              resources: [finalizeTaskFn.functionArn]
            })
          ]
        })
      }
    });


    // Grant API Gateway permission to invoke finalizer if Scheduler uses API destination / direct invoke via ARN target
    new lambda.CfnPermission(this, 'FinalizeInvokPerm', {
      action: 'lambda:InvokeFunction',
      functionName: finalizeTaskFn.functionArn,
      principal: 'scheduler.amazonaws.com'
    });


    const schedulerDlq = new sqs.Queue(this, 'SchedulerDLQ', {
      retentionPeriod: cdk.Duration.days(14),
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    this.schedulerDlqArn = schedulerDlq.queueArn;

    schedulerDlq.addToResourcePolicy(new iam.PolicyStatement({
      sid: 'AllowSchedulerSendMessage',
      principals: [new iam.ServicePrincipal('scheduler.amazonaws.com')],
      actions: ['sqs:SendMessage', 'sqs:SendMessageBatch'],
      resources: [schedulerDlq.queueArn],
    }));


    schedulerInvokeRole.addToPolicy(new iam.PolicyStatement({
      actions: ['lambda:InvokeFunction'],
      resources: [finalizeTaskFn.functionArn],
    }));

    schedulerInvokeRole.addToPolicy(new iam.PolicyStatement({
      actions: ['sqs:SendMessage', 'sqs:SendMessageBatch'],
      resources: [schedulerDlq.queueArn],
    }));



    new cdk.CfnOutput(this, 'EventBridgeSchedulerRoleArn', {
      value: schedulerRole.roleArn,
    });
  }
}

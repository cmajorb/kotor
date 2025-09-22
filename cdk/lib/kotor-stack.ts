import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { aws_lambda_nodejs } from 'aws-cdk-lib';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as sqs from 'aws-cdk-lib/aws-sqs';

export class KotorStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    // ---------- DynamoDB Tables ----------
    const usersTable = new dynamodb.Table(this, 'UsersTable', {
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    const nationsTable = new dynamodb.Table(this, 'NationsTable', {
      partitionKey: { name: 'nationId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    const tilesTable = new dynamodb.Table(this, 'TilesTable', {
      partitionKey: { name: 'tileId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    const tasksTable = new dynamodb.Table(this, 'ProductionTasksTable', {
      partitionKey: { name: 'taskId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'endsAt', type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    // Table to track WebSocket connections: map connectionId -> userId, nationId
    const connectionsTable = new dynamodb.Table(this, 'ConnectionsTable', {
      partitionKey: { name: 'connectionId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    // ---------- Cognito ----------
    const userPool = new cognito.UserPool(this, 'UserPool', {
      selfSignUpEnabled: true,
      signInAliases: { username: true, email: true }
    });
    const userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool,
      generateSecret: false
    });

    // ---------- S3 for frontend ----------
    const siteBucket = new s3.Bucket(this, 'FrontendBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      publicReadAccess: false
    });

    // ---------- WebSocket API ----------
    const wsApi = new apigwv2.CfnApi(this, 'WebSocketApi', {
      name: 'NationsOfKotorWS',
      protocolType: 'WEBSOCKET',
      routeSelectionExpression: '$request.body.action'
    });

    // Create a deployment + stage (lowest-level constructs are required for ManageConnections permissions)
    const wsStage = new apigwv2.CfnStage(this, 'WebSocketStage', {
      apiId: wsApi.ref,
      autoDeploy: true,
      stageName: 'prod'
    });

    // Helper to build Lambda functions with Node.js code in lambda/<fn>
    const mkLambda = (id: string, handlerFile: string, env?: { [k: string]: string }) =>
      new aws_lambda_nodejs.NodejsFunction(this, id, {
        entry: path.join(__dirname, `../lambda/${handlerFile}/index.ts`),
        handler: 'handler',
        runtime: lambda.Runtime.NODEJS_18_X,
        memorySize: 256,
        timeout: cdk.Duration.seconds(30),
        environment: {
          USERS_TABLE: usersTable.tableName,
          NATIONS_TABLE: nationsTable.tableName,
          TILES_TABLE: tilesTable.tableName,
          TASKS_TABLE: tasksTable.tableName,
          CONNECTIONS_TABLE: connectionsTable.tableName,
          WS_API_ID: wsApi.ref,
          WS_STAGE: wsStage.stageName || 'prod',
          ...env
        }
      });

    // $connect Lambda
    const connectFn = mkLambda('ConnectFn', 'connect');
    // $disconnect Lambda
    const disconnectFn = mkLambda('DisconnectFn', 'disconnect');
    // default (messages)
    const defaultWsFn = mkLambda('DefaultWsFn', 'defaultWs');

    // Grant connect/disconnect/default Lambdas rights to write connection records
    connectionsTable.grantWriteData(connectFn);
    connectionsTable.grantWriteData(disconnectFn);
    connectionsTable.grantReadWriteData(defaultWsFn);

    // Grant those Lambdas ability to call ApiGateway Management API (ManageConnections)
    const manageConnectionsPolicy = new iam.PolicyStatement({
      actions: ['execute-api:ManageConnections'],
      resources: [
        // Use wildcard for connections management resource
        `arn:aws:execute-api:${this.region}:${this.account}:${wsApi.ref}/*/${wsStage.stageName}/*`
      ]
    });

    connectFn.addToRolePolicy(manageConnectionsPolicy);
    disconnectFn.addToRolePolicy(manageConnectionsPolicy);
    defaultWsFn.addToRolePolicy(manageConnectionsPolicy);

    // Wire up routes using low-level constructs with Lambda integrations
    const integrationConnect = new apigwv2.CfnIntegration(this, 'ConnectIntegration', {
      apiId: wsApi.ref,
      integrationType: 'AWS_PROXY',
      integrationUri: connectFn.functionArn,
      integrationMethod: 'POST',
      payloadFormatVersion: '1.0'
    });
    const integrationDisconnect = new apigwv2.CfnIntegration(this, 'DisconnectIntegration', {
      apiId: wsApi.ref,
      integrationType: 'AWS_PROXY',
      integrationUri: disconnectFn.functionArn,
      integrationMethod: 'POST',
      payloadFormatVersion: '1.0'
    });
    const integrationDefault = new apigwv2.CfnIntegration(this, 'DefaultIntegration', {
      apiId: wsApi.ref,
      integrationType: 'AWS_PROXY',
      integrationUri: defaultWsFn.functionArn,
      integrationMethod: 'POST',
      payloadFormatVersion: '1.0'
    });

    // Routes
    new apigwv2.CfnRoute(this, 'ConnectRoute', {
      apiId: wsApi.ref,
      routeKey: '$connect',
      target: `integrations/${integrationConnect.ref}`
    });

    new apigwv2.CfnRoute(this, 'DisconnectRoute', {
      apiId: wsApi.ref,
      routeKey: '$disconnect',
      target: `integrations/${integrationDisconnect.ref}`
    });

    new apigwv2.CfnRoute(this, 'DefaultRoute', {
      apiId: wsApi.ref,
      routeKey: '$default',
      target: `integrations/${integrationDefault.ref}`
    });

    // Grant invoke permission for API gateway to call lambda (connect/disconnect/default)
    new lambda.CfnPermission(this, 'ConnectPermission', {
      action: 'lambda:InvokeFunction',
      functionName: connectFn.functionArn,
      principal: 'apigateway.amazonaws.com',
      sourceArn: `arn:aws:execute-api:${this.region}:${this.account}:${wsApi.ref}/*/${wsStage.stageName}/$connect`
    });
    new lambda.CfnPermission(this, 'DisconnectPermission', {
      action: 'lambda:InvokeFunction',
      functionName: disconnectFn.functionArn,
      principal: 'apigateway.amazonaws.com',
      sourceArn: `arn:aws:execute-api:${this.region}:${this.account}:${wsApi.ref}/*/${wsStage.stageName}/$disconnect`
    });
    new lambda.CfnPermission(this, 'DefaultPermission', {
      action: 'lambda:InvokeFunction',
      functionName: defaultWsFn.functionArn,
      principal: 'apigateway.amazonaws.com',
      sourceArn: `arn:aws:execute-api:${this.region}:${this.account}:${wsApi.ref}/*/${wsStage.stageName}/$default`
    });

    // ---------- REST HTTP API for task creation ----------
    const httpApi = new apigwv2.HttpApi(this, 'NationsHttpApi', {
      apiName: 'NationsOfKotorAPI',
      corsPreflight: {
        allowOrigins: ['*'], // In production, restrict this to your domain
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ['Content-Type'],
      },
    });

    // Role for EventBridge to use
    const schedulerRole = new iam.Role(this, 'EventBridgeSchedulerRole', {
      assumedBy: new iam.ServicePrincipal('scheduler.amazonaws.com'),
    });

    // For the finalize task Lambda, create it first and then create an EventBridge Scheduler target that invokes it
    const finalizeTaskFn = mkLambda('FinalizeTaskFn', 'finalizeTask');
    tasksTable.grantReadWriteData(finalizeTaskFn);
    // Finalizer needs to post to websocket connections -> grant ManageConnections
    finalizeTaskFn.addToRolePolicy(manageConnectionsPolicy);

    connectionsTable.grantReadData(finalizeTaskFn);


    // Grant API Gateway permission to invoke finalizer if Scheduler uses API destination / direct invoke via ARN target
    new lambda.CfnPermission(this, 'FinalizeInvokPerm', {
      action: 'lambda:InvokeFunction',
      functionName: finalizeTaskFn.functionArn,
      principal: 'scheduler.amazonaws.com'
    });


    const schedulerDlq = new sqs.Queue(this, 'SchedulerDLQ', {
      queueName: 'NationsOfKotor-Scheduler-DLQ',
      retentionPeriod: cdk.Duration.days(14),
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Allow the EventBridge Scheduler service to send messages to the DLQ
    schedulerDlq.addToResourcePolicy(new iam.PolicyStatement({
      sid: 'AllowSchedulerSendMessage',
      principals: [new iam.ServicePrincipal('scheduler.amazonaws.com')],
      actions: ['sqs:SendMessage', 'sqs:SendMessageBatch'],
      resources: [schedulerDlq.queueArn],
    }));

    const createTaskFn = mkLambda('CreateTaskFn', 'createTask', { SCHEDULER_ROLE_ARN: schedulerRole.roleArn, FINALIZER_ARN: finalizeTaskFn.functionArn, SCHEDULER_DLQ_ARN: schedulerDlq.queueArn });
    tasksTable.grantReadWriteData(createTaskFn);
    // createTask needs Scheduler:createSchedule and scheduler:TagResource*, and DynamoDB write permissions
    createTaskFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['scheduler:CreateSchedule', 'scheduler:DeleteSchedule', 'iam:PassRole'],
      resources: ['*'] // narrower by building ARNs in prod
    }));

    // Grant permission to invoke the Lambda
    schedulerRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['lambda:InvokeFunction'],
      resources: [finalizeTaskFn.functionArn],
    }));

    new cdk.CfnOutput(this, 'EventBridgeSchedulerRoleArn', {
      value: schedulerRole.roleArn,
    });

    // Hook CreateTask Lambda to the HTTP API
    const createIntegration = new HttpLambdaIntegration('MyIntegration', createTaskFn, {
      payloadFormatVersion: apigwv2.PayloadFormatVersion.VERSION_1_0 // 👈 Force version 1.0
    });

    httpApi.addRoutes({
      path: '/create-task',
      methods: [apigwv2.HttpMethod.POST],
      integration: createIntegration
    });

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

    schedulerInvokeRole.addToPolicy(new iam.PolicyStatement({
      actions: ['lambda:InvokeFunction'],
      resources: [finalizeTaskFn.functionArn],
    }));
    
    schedulerInvokeRole.addToPolicy(new iam.PolicyStatement({
      actions: ['sqs:SendMessage', 'sqs:SendMessageBatch'],
      resources: [schedulerDlq.queueArn],
    }));

    // Allow CreateTask Lambda to create schedules that use the schedulerInvokeRole
    createTaskFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['iam:PassRole'],
      resources: [schedulerInvokeRole.roleArn]
    }));

    // Export key values as stack outputs for frontend config if desired
    new cdk.CfnOutput(this, 'WebSocketApiUrl', { value: `wss://${wsApi.ref}.execute-api.${this.region}.amazonaws.com/${wsStage.stageName}` });
    new cdk.CfnOutput(this, 'HttpApiUrl', { value: httpApi.apiEndpoint });
    new cdk.CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
    new cdk.CfnOutput(this, 'UserPoolClientId', { value: userPoolClient.userPoolClientId });

    // Grant read to site deployer if you want; we won't make site public inside CDK

  }
}

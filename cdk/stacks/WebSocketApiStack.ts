// stacks/WebSocketApiStack.ts
import * as cdk from 'aws-cdk-lib';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { mkLambda } from '../constructs/LambdaFactory';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';

interface WebSocketApiStackProps extends cdk.StackProps {
    connectionsTable: dynamodb.Table;
}

export class WebSocketApiStack extends cdk.Stack {
    public readonly wsApi: apigwv2.CfnApi;
    public readonly wsStage: apigwv2.CfnStage;
    constructor(scope: Construct, id: string, props: WebSocketApiStackProps) {
        super(scope, id, props);

        const { connectionsTable } = props;

        // WebSocket API
        this.wsApi = new apigwv2.CfnApi(this, 'WebSocketApi', {
            name: 'NationsOfKotorWS',
            protocolType: 'WEBSOCKET',
            routeSelectionExpression: '$request.body.action'
        });

        this.wsStage = new apigwv2.CfnStage(this, 'WebSocketStage', {
            apiId: this.wsApi.ref,
            autoDeploy: true,
            stageName: 'prod'
        });

        // Lambdas
        const connectFn = mkLambda(this, 'ConnectFn', 'connect', { CONNECTIONS_TABLE: connectionsTable.tableName });
        const disconnectFn = mkLambda(this, 'DisconnectFn', 'disconnect', { CONNECTIONS_TABLE: connectionsTable.tableName });
        const defaultWsFn = mkLambda(this, 'DefaultWsFn', 'defaultWs', { CONNECTIONS_TABLE: connectionsTable.tableName });

        // DynamoDB grants
        connectionsTable.grantWriteData(connectFn);
        connectionsTable.grantWriteData(disconnectFn);
        connectionsTable.grantReadWriteData(defaultWsFn);

        // ManageConnections policy
        const manageConnectionsPolicy = new iam.PolicyStatement({
            actions: ['execute-api:ManageConnections'],
            resources: [`arn:aws:execute-api:${this.region}:${this.account}:${this.wsApi.ref}/*/*`]
        });

        [connectFn, disconnectFn, defaultWsFn].forEach(fn => fn.addToRolePolicy(manageConnectionsPolicy));

        const lambdaIntegrationUri = (lambdaFn: lambda.Function) => 
            `arn:aws:apigateway:${this.region}:lambda:path/2015-03-31/functions/${lambdaFn.functionArn}/invocations`;
            

        // Integrations
        const connectIntegration = new apigwv2.CfnIntegration(this, 'ConnectIntegration', {
            apiId: this.wsApi.ref,
            integrationType: 'AWS_PROXY',
            integrationUri: lambdaIntegrationUri(connectFn),
            integrationMethod: 'POST',
            payloadFormatVersion: '1.0'
        });
        const disconnectIntegration = new apigwv2.CfnIntegration(this, 'DisconnectIntegration', {
            apiId: this.wsApi.ref,
            integrationType: 'AWS_PROXY',
            integrationUri: lambdaIntegrationUri(disconnectFn),
            integrationMethod: 'POST',
            payloadFormatVersion: '1.0'
        });
        const defaultIntegration = new apigwv2.CfnIntegration(this, 'DefaultIntegration', {
            apiId: this.wsApi.ref,
            integrationType: 'AWS_PROXY',
            integrationUri: lambdaIntegrationUri(defaultWsFn),
            integrationMethod: 'POST',
            payloadFormatVersion: '1.0'
        });

        // Routes
        new apigwv2.CfnRoute(this, 'ConnectRoute', {
            apiId: this.wsApi.ref,
            routeKey: '$connect',
            target: `integrations/${connectIntegration.ref}`
        });
        new apigwv2.CfnRoute(this, 'DisconnectRoute', {
            apiId: this.wsApi.ref,
            routeKey: '$disconnect',
            target: `integrations/${disconnectIntegration.ref}`
        });
        new apigwv2.CfnRoute(this, 'DefaultRoute', {
            apiId: this.wsApi.ref,
            routeKey: '$default',
            target: `integrations/${defaultIntegration.ref}`
        });

        // Outputs
        new cdk.CfnOutput(this, 'WebSocketApiUrl', {
            value: `wss://${this.wsApi.ref}.execute-api.${this.region}.amazonaws.com/${this.wsStage.stageName}`
        });

        new lambda.CfnPermission(this, 'ConnectPermission', {
            action: 'lambda:InvokeFunction',
            functionName: connectFn.functionName,
            principal: 'apigateway.amazonaws.com',
            sourceArn: `arn:aws:execute-api:${this.region}:${this.account}:${this.wsApi.ref}/*/$connect`,
        });

        new lambda.CfnPermission(this, 'DisconnectPermission', {
            action: 'lambda:InvokeFunction',
            functionName: disconnectFn.functionName,
            principal: 'apigateway.amazonaws.com',
            sourceArn: `arn:aws:execute-api:${this.region}:${this.account}:${this.wsApi.ref}/*/$disconnect`,
        });

        new lambda.CfnPermission(this, 'DefaultPermission', {
            action: 'lambda:InvokeFunction',
            functionName: defaultWsFn.functionName,
            principal: 'apigateway.amazonaws.com',
            sourceArn: `arn:aws:execute-api:${this.region}:${this.account}:${this.wsApi.ref}/*/$default`,
        });
    }
}

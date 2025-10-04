// stacks/HttpApiStack.ts
import * as cdk from 'aws-cdk-lib';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { Construct } from 'constructs';
import { mkLambda } from '../constructs/LambdaFactory';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';

interface HttpApiStackProps extends cdk.StackProps {
    connectionsTable: dynamodb.Table;
    tilesTable: dynamodb.Table;
    wsApi: apigwv2.CfnApi;
    wsStage: apigwv2.CfnStage;
    schedulerRoleArn: string;
    finalizeTaskFnArn: string;
    schedulerDlqArn: string;
}

export class HttpApiStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: HttpApiStackProps) {
        super(scope, id, props);

        const { connectionsTable, tilesTable, wsApi, wsStage, schedulerRoleArn, finalizeTaskFnArn, schedulerDlqArn } = props;

        const httpApi = new apigwv2.HttpApi(this, 'NationsHttpApi', {
            apiName: 'NationsOfKotorAPI',
            corsPreflight: {
                allowOrigins: ['*'],
                allowMethods: [apigwv2.CorsHttpMethod.GET, apigwv2.CorsHttpMethod.POST],
                allowHeaders: ['Content-Type'],
            },
        });

        const mapFn = mkLambda(this, 'MapFn', 'map', {
            TILES_TABLE: tilesTable.tableName,
            CONNECTIONS_TABLE: connectionsTable.tableName,
            WS_API_ID: wsApi.ref,
            WS_STAGE: wsStage.stageName || 'prod'
        });
        const entitiesFn = mkLambda(this, 'EntitiesFn', 'entities');
        const createTaskFn = mkLambda(this, 'CreateTaskFn', 'createTask', {
            SCHEDULER_ROLE_ARN: schedulerRoleArn,
            FINALIZER_ARN: finalizeTaskFnArn,
            SCHEDULER_DLQ_ARN: schedulerDlqArn
        });

        const manageConnectionsPolicy = new iam.PolicyStatement({
            actions: ['execute-api:ManageConnections'],
            resources: [`arn:aws:execute-api:${this.region}:${this.account}:${props.wsApi.ref}/*/*`]
        });

        entitiesFn.addToRolePolicy(manageConnectionsPolicy);
        mapFn.addToRolePolicy(manageConnectionsPolicy);

        tilesTable.grantReadWriteData(mapFn);
        connectionsTable.grantReadData(mapFn);

        createTaskFn.addToRolePolicy(new iam.PolicyStatement({
            actions: ['scheduler:CreateSchedule', 'scheduler:DeleteSchedule', 'iam:PassRole'],
            resources: ['*'] // narrower by building ARNs in prod
        }));

        httpApi.addRoutes({
            path: '/map',
            methods: [apigwv2.HttpMethod.GET],
            integration: new HttpLambdaIntegration('MapIntegration', mapFn)
        });

        httpApi.addRoutes({
            path: '/map/entity',
            methods: [apigwv2.HttpMethod.POST],
            integration: new HttpLambdaIntegration('MapIntegration', mapFn)
        });

        httpApi.addRoutes({
            path: '/create-task',
            methods: [apigwv2.HttpMethod.POST],
            integration: new HttpLambdaIntegration('TaskIntegration', createTaskFn)
        });

        httpApi.addRoutes({
            path: '/entities',
            methods: [apigwv2.HttpMethod.GET],
            integration: new HttpLambdaIntegration('EntityIntegration', entitiesFn)
        });



        new cdk.CfnOutput(this, 'HttpApiUrl', { value: httpApi.apiEndpoint });
    }
}

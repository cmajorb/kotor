// constructs/LambdaFactory.ts
import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { aws_lambda_nodejs as nodejs } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export function mkLambda(scope: Construct, id: string, handlerFile: string, env?: { [k: string]: string }) {
  return new nodejs.NodejsFunction(scope, id, {
    entry: path.join(__dirname, `../lambda/${handlerFile}/index.ts`),
    handler: 'handler',
    runtime: lambda.Runtime.NODEJS_18_X,
    memorySize: 256,
    timeout: cdk.Duration.seconds(30),
    environment: env
  });
}

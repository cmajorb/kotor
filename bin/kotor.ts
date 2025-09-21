#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { KotorStack } from '../lib/kotor-stack';

const app = new cdk.App();
new KotorStack(app, 'KotorStack', {
  
});
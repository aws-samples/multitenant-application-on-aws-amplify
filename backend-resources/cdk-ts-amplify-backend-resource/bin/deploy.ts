#!/usr/bin/env node
/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 */
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AmplifyMultiTenantResourceStack } from '../lib/AppStack'; 
import { AwsSolutionsChecks } from 'cdk-nag'
import { Aspects } from 'aws-cdk-lib';

import {config} from '../config'; 

const app = new cdk.App();

//User account details from AWS CLI credentials: 
const account = process.env.CDK_DEFAULT_ACCOUNT;
const region = process.env.CDK_DEFAULT_REGION
const env = {account, region}; 


// Add the cdk-nag AwsSolutions Pack with extra verbose logging enabled.
 //Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }))

new AmplifyMultiTenantResourceStack(app, `backend`, {
  stackName: `${config.solutionName}-${config.environment}`,
  env,
  ...config
});


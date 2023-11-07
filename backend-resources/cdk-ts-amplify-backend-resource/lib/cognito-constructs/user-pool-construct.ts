/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 */

import {StackProps, Tags, RemovalPolicy, Duration, Stack } from 'aws-cdk-lib';
import {Construct} from 'constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import {NodejsFunction, SourceMapMode} from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'path';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { names } from '../../config';
import { AccountRecovery } from 'aws-cdk-lib/aws-cognito';
import { NagSuppressions } from 'cdk-nag'

export interface IStackProps extends StackProps{
  defaultDomain: string; 
  environment: string; 
  costcenter: string; 
  solutionName: string; 
}



export class UserPoolConstruct extends Construct {
  public readonly userPool: cognito.UserPool;

  constructor(scope: Construct, id: string, props: IStackProps) {
    super(scope, id);
    
    const tokenGenerationLambdaFunctionRole = new iam.Role(this, `token-generation-LambdaRole`, {
      roleName: `${props.solutionName}-tokenGenerationLambdaRole-${props.environment}`,
      description: "PreTokenGenerationFunctionRole",
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole")
      ],
      inlinePolicies: {
        ReadTablePolicy: new iam.PolicyDocument({
          assignSids:true,
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              resources: [`arn:aws:dynamodb:${props.env?.region}:${props.env?.account}:table/${names.dynamodbAdminUserTableName}`],
              actions: [
                "dynamodb:BatchGetItem",
                "dynamodb:ConditionCheckItem",
                "dynamodb:DescribeTable",
                "dynamodb:GetItem",
                "dynamodb:GetRecords",
                "dynamodb:GetShardIterator",
                "dynamodb:Query",
                "dynamodb:Scan"
              ],
            }),
          ],
        }),
      }
    });

    NagSuppressions.addResourceSuppressions(
      tokenGenerationLambdaFunctionRole,
      [
        {
          id: 'AwsSolutions-IAM4',
          reason: 'Needs access to write to CloudWatch Logs',
          appliesTo: [
            'Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
          ],
        },
      ],
      true
    );


    const tokenGenerationLambda = new NodejsFunction(this,'TokenGenerationLambda',{
      functionName: `${props.solutionName}-token-generation-lambda--${props.environment}`,
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, '../lambda-code/cognito-triggers/tokengen/index.ts'),
      handler: 'lambdaHandler',
      role: tokenGenerationLambdaFunctionRole,
      environment: {
        TABLE_NAME: names.dynamodbAdminUserTableName,
      },
      bundling: {
        externalModules: [
          'aws-sdk', 
          '@aws-sdk/client-dynamodb'
        ],
        minify: true,
        sourceMap: true, 
        sourceMapMode: SourceMapMode.INLINE, 
        sourcesContent: false,
        target: 'es2020', 
      },
       logRetention: RetentionDays.ONE_WEEK,
    }
  );

    const customMessagesLambdaFunctionRole = new iam.Role(this, `custom-messages-LambdaRole`, {
      roleName: `${props.solutionName}-customMessagesLambdaRole-${props.environment}`,
      description: "Cognito UserPool Custom Messages Lambda Function Role",
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole")
      ]
    });

    NagSuppressions.addResourceSuppressions(
      customMessagesLambdaFunctionRole,
      [
        {
          id: 'AwsSolutions-IAM4',
          reason: 'Needs access to write to CloudWatch Logs',
          appliesTo: [
            'Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
          ],
        },
      ],
      true
    );
 
    const customMessagesTrigger = new NodejsFunction(this, 'custom-messages', {
      functionName: `${props.solutionName}-customMessagesTrigger-${props.environment}`,
      role: customMessagesLambdaFunctionRole,
      runtime: lambda.Runtime.NODEJS_18_X,
      memorySize: 1024,
      timeout: Duration.seconds(6),
      handler: 'main',
      entry: path.join(__dirname, '../lambda-code/cognito-triggers/cognito-custom-messages/index.ts'),
      environment: {
        FRONTEND_BASE_URL: props.defaultDomain
      },
      bundling: {
        minify: true, 
        sourceMap: true, 
        sourceMapMode: SourceMapMode.INLINE, 
        sourcesContent: false, 
        target: 'es2020', 
      },
    }); 
    



    this.userPool = new cognito.UserPool(this, 'userpool', {
      userPoolName: names.userPoolName,
     // selfSignUpEnabled: true,
      signInAliases: {
        preferredUsername: true,
        username: true, 
      },
      signInCaseSensitive: false, 
      autoVerify: {
        email: true,
      },
      standardAttributes: {
        preferredUsername: {
          required: true, 
          mutable: true 
        },
        email:{ 
          required: true,
          mutable: true
        }
      },
      customAttributes: {
        role: new cognito.StringAttribute({mutable: true}),
        isAdmin: new cognito.StringAttribute({mutable: true}),
        tenantId: new cognito.StringAttribute({mutable: false}) //tenantId is immutable therefore cannot be changed once set
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireDigits: true,
        requireUppercase: true,
        requireSymbols: true,
        tempPasswordValidity: Duration.days(7)
      },
      accountRecovery: AccountRecovery.EMAIL_ONLY,
      lambdaTriggers: {
        customMessage: customMessagesTrigger,
        preTokenGeneration: tokenGenerationLambda
      },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    NagSuppressions.addResourceSuppressions(this.userPool, [
      {
        id: 'AwsSolutions-COG2',
        reason: 'Demo does not use MFA'
      },
      {
        id: 'AwsSolutions-COG3',
        reason: 'Demo does not use advanced security features'
      }
    ])


    Tags.of(this).add("environment", props.environment)
    Tags.of(this).add("solution", props.solutionName)
    Tags.of(this).add("costcenter", props.costcenter)


  }
}

/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 */

import { StackProps, Tags, CfnOutput, Stack, RemovalPolicy, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { StateMachine, LogLevel, InputType } from 'aws-cdk-lib/aws-stepfunctions';
import { AwsCustomResource, AwsCustomResourcePolicy, PhysicalResourceId } from 'aws-cdk-lib/custom-resources';
import { LambdaInvoke } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { UserPool } from 'aws-cdk-lib/aws-cognito';
import { names } from '../../config';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { NodejsFunction, SourceMapMode } from 'aws-cdk-lib/aws-lambda-nodejs';
import { IFunction, Runtime } from 'aws-cdk-lib/aws-lambda';
import path = require('path');
import { Effect, ManagedPolicy, PolicyDocument, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { NagSuppressions } from 'cdk-nag'


interface UpdateConstructProps extends StackProps {
  userPool: UserPool;
  environment: string;
  solutionName: string;
  costcenter: string;
}

export class StateMachineCreateCognitoUserConstruct extends Construct {
  constructor(scope: Construct, id: string, props: UpdateConstructProps) {
    super(scope, id);

    const FunctionRole = new Role(this, `cognito-Identity-LambdaRole`, {
      roleName: `${props.solutionName}-cognitoIdentityGeneralLambdaRole-${props.environment}`,
      description: "Manage Cognito Users",
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole")
      ],
      inlinePolicies: {
        ReadTablePolicy: new PolicyDocument({
          assignSids:true,
          statements: [
            new PolicyStatement({
              effect: Effect.ALLOW,
              resources: [props.userPool.userPoolArn],
              actions: [
                "cognito-idp:AdminCreateUser",
                "cognito-idp:AdminDeleteUser",
                "cognito-idp:AdminDeleteUserAttributes",
                "cognito-idp:AddCustomAttributes",
                "cognito-idp:AdminAddUserToGroup"
              ],
            }),
          ],
        }),
      }
    });
  
  
    const adminCreateUserLambda = new NodejsFunction(this,'adminCreateUserLambda',{
        functionName: `${props.solutionName}-create-user-${props.environment}`,
        runtime: Runtime.NODEJS_18_X, 
        entry: path.join(__dirname, '../lambda-code/statemachine-functions/adminCreateUserLambda/index.ts'),
        depsLockFilePath: path.join(__dirname, '../lambda-code/statemachine-functions/adminCreateUserLambda/package-lock.json'),
        handler: 'handler',
        role: FunctionRole,
        bundling: {
          externalModules: [
            '@aws-sdk/*',
            'aws-lambda'
          ],
          nodeModules: [
            '@aws-sdk/client-cognito-identity-provider', 
           //'aws-sdk'
          ],
          minify: true, 
          sourceMap: true, 
          sourceMapMode: SourceMapMode.INLINE, 
          sourcesContent: false, 
          target: 'es2020', 
        },
        logRetention: RetentionDays.ONE_DAY,
      }
    );

    const adminAddUserToGroupLambda = new NodejsFunction(this,'adminAddUserToGroupLambda',{
      functionName: `${props.solutionName}-add-to-group-${props.environment}`,
      runtime: Runtime.NODEJS_18_X, 
      entry: path.join(__dirname, '../lambda-code/statemachine-functions/adminAddUserToGroupLambda/index.ts'),
      depsLockFilePath: path.join(__dirname, '../lambda-code/statemachine-functions/adminAddUserToGroupLambda/package-lock.json'),
      handler: 'handler',
      role: FunctionRole,
      bundling: {
        externalModules: [
           //'@aws-sdk/*'
         ],
         nodeModules: [
          // '@aws-sdk/client-cognito-identity-provider', 
          'aws-sdk'
         ],
        minify: true, 
        sourceMap: true,
        sourceMapMode: SourceMapMode.INLINE, 
        sourcesContent: false, 
        target: 'es2020', 
      },
      logRetention: RetentionDays.ONE_DAY,
    }
  );

    const globalAdminTempPassword: string = names.globalAdminDefaultUser.tempPassword

    new CfnOutput(this, 'globalAdminTempPassword', { value: globalAdminTempPassword })

    const StepFunctionRole = new Role(this, `GlobalAdminStateMachineRole`, {
      roleName: `${props.solutionName}-create-global-admin-sfn-${props.environment}`,
      description: "StateMachine Role",
      assumedBy: new ServicePrincipal(`states.${Stack.of(this).region}.amazonaws.com`),
      inlinePolicies: {
        InvokeLambdaPolicy: new PolicyDocument({
          assignSids:true,
          statements: [
            new PolicyStatement({
              effect: Effect.ALLOW,
              resources: [
                adminAddUserToGroupLambda.functionArn,
                adminCreateUserLambda.functionArn,
               // `arn:aws:lambda:${Stack.of(this).region}:${Stack.of(this).account}:function:${createUserPoolGroupLambda.functionName}:*`,
               // `arn:aws:lambda:${Stack.of(this).region}:${Stack.of(this).account}:function:${extractCognitoGroupsLambda.functionName}:*`
              ],
              actions: [
                "lambda:InvokeFunction"
              ],
            }),
          ],
        }),
      CloudWatchLogPolicy: new PolicyDocument({
        assignSids:true,
        statements: [
          new PolicyStatement({
            effect: Effect.ALLOW,
            resources: [
              `arn:aws:logs:${Stack.of(this).region}:${Stack.of(this).account}:*`, 
            ],
            actions: [
              "logs:CreateLogDelivery",
              "logs:DeleteLogDelivery",
              "logs:DescribeLogGroups",
              "logs:DescribeResourcePolicies",
              "logs:GetLogDelivery",
              "logs:ListLogDeliveries",
              "logs:PutResourcePolicy",
              "logs:UpdateLogDelivery"
            ],
          }),
        ],
      })
      }
    });




    // Define the Step Functions state machine
    const stateMachine = new StateMachine(this, 'GlobalAdminStateMachine', {
      definition: this.createStateMachineDefinition(props.userPool, adminCreateUserLambda, adminAddUserToGroupLambda, globalAdminTempPassword ),
      stateMachineName: `${props.solutionName}-createGlobalAdmin-statemachine-${props.environment}`,
      role: StepFunctionRole, 
      tracingEnabled: true, 
      logs: {
        destination: new LogGroup(this, 'logGroup', {
          logGroupName: `/aws/vendedlogs/states/${props.solutionName}-createGlobalAdmin-sfn-${props.environment}`,
          removalPolicy: RemovalPolicy.DESTROY,
          retention: RetentionDays.ONE_WEEK,
        }),
        includeExecutionData: true,
        level: LogLevel.ALL,
      },
    });


    const invokeStateMachine = new AwsCustomResource(this, 'InvokeGlobalAdminStateMachine', {
      onCreate: {
        service: 'StepFunctions',
        action: 'startExecution',
        parameters: {
          stateMachineArn: stateMachine.stateMachineArn,
        },
        physicalResourceId: PhysicalResourceId.of(stateMachine.stateMachineArn),
      },
      policy: AwsCustomResourcePolicy.fromSdkCalls({
        resources: [stateMachine.stateMachineArn],
      }),
    });

    NagSuppressions.addResourceSuppressions([stateMachine, StepFunctionRole], 
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'Creates Default policy providing write access to CloudWatch Logs',
          // appliesTo: [
          //  "Action::logs:DeleteRetentionPolicy",
          //  "Action::logs:PutRetentionPolicy"
          // ]
        },
        {
          id: 'AwsSolutions-IAM5',
          reason: 'Creates Default policy providing write access to CloudWatch Logs',
          appliesTo: [
           "Action::logs:DeleteRetentionPolicy",
           "Action::logs:PutRetentionPolicy"
          ]
        },
      ],true)
    
    NagSuppressions.addResourceSuppressions([FunctionRole], [
      {
        id: 'AwsSolutions-IAM4',
        reason: 'Needs access to write to CloudWatch Logs',
      },
      {
        id: 'AwsSolutions-IAM5',
        reason: 'StateMachine Creates Default policy providing write access to CloudWatch Logs'
      }
    ],true)


    
    Tags.of(this).add("environment", props.environment);
    Tags.of(this).add("solution", props.solutionName);
    Tags.of(this).add("costcenter", props.costcenter);
  }




  private createStateMachineDefinition(userPool: UserPool, adminCreateUserLambda: IFunction, adminAddUserToGroupLambda:IFunction, globalAdminTempPassword: string ) {
    const createUserTask = new LambdaInvoke(this, 'CreateGlobalAdminUserTask', {
      lambdaFunction: adminCreateUserLambda,
      payload: {
        type: InputType.OBJECT,
        value: 
          {
         UserPoolId: userPool.userPoolId,
         Username: names.globalAdminDefaultUser.email,
         TemporaryPassword: globalAdminTempPassword, 
         UserAttributes: [
           {
             Name: 'preferred_username',
             Value: names.globalAdminDefaultUser.preferredUsername,
           },
           {
             Name: 'email',
             Value: names.globalAdminDefaultUser.email,
           },
         ],
       },
      }
    });
 
    const addUserToGroupTask = new LambdaInvoke(this, 'AddUserToGroupTask', {
      lambdaFunction: adminAddUserToGroupLambda,
      payload: {
        type: InputType.OBJECT,
        value:{
        UserPoolId: userPool.userPoolId,
        Username: names.globalAdminDefaultUser.email,
        GroupName: names.cognitoGlobalAdminGroupName
        }
      },
    });

    createUserTask.next(addUserToGroupTask);

    addUserToGroupTask.addRetry({
      maxAttempts: 3, 
      interval: Duration.minutes(1), 
      errors: ['States.ALL'], 
      backoffRate: 2,
    });

     

    return createUserTask;
  }
}

/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 */

import { StackProps, Tags, Stack, RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { StateMachine, JsonPath, LogLevel } from 'aws-cdk-lib/aws-stepfunctions';
import { AwsCustomResource, AwsCustomResourcePolicy, PhysicalResourceId } from 'aws-cdk-lib/custom-resources';
import { GraphqlApi} from 'aws-cdk-lib/aws-appsync'
import {Bucket} from 'aws-cdk-lib/aws-s3';
import { CallAwsService } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as codecommit from 'aws-cdk-lib/aws-codecommit';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Effect, PolicyDocument, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { RestApi} from 'aws-cdk-lib/aws-apigateway';
import { CfnIdentityPool, UserPool, UserPoolClient } from 'aws-cdk-lib/aws-cognito';
import {names} from '../../config'
import { NagSuppressions } from 'cdk-nag'

interface UpdateConstructProps extends StackProps {
  appId: string; 
  adminApi: RestApi;
  userPool: UserPool;
  identityPool: CfnIdentityPool;
  userPoolClient: UserPoolClient;
  storageBucket: Bucket; 
  graphqlAPI: GraphqlApi; 
  codeCommitRepo: codecommit.Repository; 
  AmplifyServiceRole: Role
  environment: string;
  solutionName: string;
  costcenter: string;
}

export class StateMachineUpdateAmplifyAppConstruct extends Construct {
  constructor(scope: Construct, id: string, props: UpdateConstructProps) {
    super(scope, id);

    const { region, account }  = Stack.of(this)
    const amplifyAppArn = `arn:aws:amplify:${region}:${account}:apps/${props.appId}`

    const StepFunctionRole = new Role(this, `UpdateAmplifyStateMachineRole`, {
      roleName: `${props.solutionName}-update-app-sfn-${props.environment}`,
      description: "StateMachine Role",
      assumedBy: new ServicePrincipal(`states.${region}.amazonaws.com`),
      inlinePolicies: {
        InvokeResources : new PolicyDocument({
          assignSids:true,
          statements: [
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: [
                'Amplify:UpdateApp',
                `amplify:CreateBranch`
            ],
              resources: [
                amplifyAppArn,
                `arn:aws:amplify:${Stack.of(this).region}:${Stack.of(this).account}:apps/${props.appId}/branches/*`
              ],
            }),
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: [
                'iam:PassRole'
            ],
              resources: [
                props.AmplifyServiceRole.roleArn,
              ],
            }),
            new PolicyStatement({
              effect: Effect.ALLOW,
              actions: [
                'codecommit:GetRepository', 
                'codecommit:GetRepositoryTriggers',
                'codecommit:PutRepositoryTriggers',
                'SNS:CreateTopic',
                'SNS:Subscribe'
            ],
              resources: [
                props.codeCommitRepo.repositoryArn,
                `arn:aws:sns:${region}:${account}:amplify_codecommit_topic`
              ],
            })
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
    const stateMachine = new StateMachine(this, 'UpdateAppStateMachine', {
      definition: this.createStateMachineDefinition(), 
      stateMachineName: `${props.solutionName}-update-app-sfn-${props.environment}`,
      role: StepFunctionRole, 
      removalPolicy: RemovalPolicy.DESTROY,
      tracingEnabled: true, 
      logs: {
        destination: new LogGroup(this, "updateAppLogGroup", {
          logGroupName: `/aws/vendedlogs/states/${props.solutionName}-update-app-sfn-${props.environment}`,
          removalPolicy: RemovalPolicy.DESTROY,
          retention: RetentionDays.ONE_WEEK, 
        }), 
        level: LogLevel.ALL,
        includeExecutionData: true 
      },
    });

        
        NagSuppressions.addResourceSuppressions(
          [StepFunctionRole ], 
        [
          {
            id: 'AwsSolutions-IAM5',
            reason: 'StateMachine Creates Default policy providing region & account bounded access to write to CloudWatch Logs',
          },
        ],true)



      const  environmentVariables = {
          REACT_APP_adminApiUrl: props.adminApi.url.endsWith('/') ? props.adminApi.url.slice(0, -1) : props.adminApi.url,
          REACT_APP_storageBucketName: props.storageBucket.bucketName, 
          REACT_APP_graphQLApiUrl: props.graphqlAPI.graphqlUrl, 
          REACT_APP_graphQLApiId: props.graphqlAPI.apiId, 
          REACT_APP_userPoolId: props.userPool.userPoolId, 
          REACT_APP_userPoolWebClientId: props.userPoolClient.userPoolClientId, 
          REACT_APP_identityPoolId: props.identityPool.ref,
          REACT_APP_stackRegion: props.env?.region, 
          _LIVE_UPDATES : '[{"pkg":"@aws-amplify/cli","type":"npm","version":"latest"}]'
        }


      const crProps = {
        appId: props.appId,
        repository: props.codeCommitRepo.repositoryCloneUrlHttp,
        iamServiceRoleArn: props.AmplifyServiceRole.roleArn,
        branchName: names.codecommitRepoBranchName, //"main", /* required */ // Must also match name of the git repo branch, in the case of codecommit the default branch is named 'main'
        description: 'codecommit main branch',
         enableAutoBuild: true,
         environmentVariables, 
         updateAppOutput: "placeholder", 
         backendEndName: props.environment, 
      };

      // Invoke the Step Functions state machine for the current tenantId during CDK deploy
      new AwsCustomResource(this, `InvokeUpdateAppStateMachine`, {
        onCreate: {
          service: 'StepFunctions',
          action: 'startExecution',
          parameters: {
            stateMachineArn: stateMachine.stateMachineArn,
            input: JSON.stringify({ crProps  }),
          },
          physicalResourceId: PhysicalResourceId.of(stateMachine.stateMachineArn),
        },
        policy: AwsCustomResourcePolicy.fromSdkCalls({
          resources: [stateMachine.stateMachineArn],
        }),
      });

 

    Tags.of(this).add("environment", props.environment);
    Tags.of(this).add("solution", props.solutionName);
    Tags.of(this).add("costcenter", props.costcenter);
  }

  private createStateMachineDefinition() {
    const createUpdateAppTask = new CallAwsService(this, 'UpdateAppTask', {
      service: 'Amplify',
      action: 'updateApp',
      comment: `update amplify app`, 
      parameters: {
        AppId: JsonPath.stringAt('$.crProps.appId'),
        Repository: JsonPath.stringAt('$.crProps.repository'),
        IamServiceRoleArn: JsonPath.stringAt('$.crProps.iamServiceRoleArn'),
      },
      iamResources: ['*'],
      resultPath: JsonPath.stringAt('$.crProps.updateAppOutput')
    });

    const createBackendTask = new CallAwsService(this, 'createAmplifyBackend', {
      service: 'Amplify',
      action: 'createBackendEnvironment',
      comment: 'Create Amplify backend environment',
      parameters: {
        AppId: JsonPath.stringAt('$.crProps.updateAppOutput.App.AppId'),
        EnvironmentName: JsonPath.stringAt('$.crProps.backendEndName'),
      },
      iamResources: ['*'],
      resultPath: JsonPath.stringAt('$.crProps.backendOutput'),
    });

    const createAmplifyBranchTask = new CallAwsService(this, 'CreateBranchTask', {
      service: 'Amplify',
      action: 'createBranch',
      comment: `create Branch `, 
      parameters: {
        AppId: JsonPath.stringAt('$.crProps.appId'),
        BranchName: JsonPath.stringAt('$.crProps.branchName'),
        BackendEnvironmentArn: JsonPath.stringAt('$.crProps.backendOutput.BackendEnvironment.BackendEnvironmentArn'),
        Description: JsonPath.stringAt('$.crProps.description'),
        EnableAutoBuild: JsonPath.stringAt('$.crProps.enableAutoBuild'),
        EnvironmentVariables: JsonPath.objectAt('$.crProps.environmentVariables'), 
      },
      iamResources: ['*'],
    });

    createUpdateAppTask.next(createBackendTask).next(createAmplifyBranchTask)



    return createUpdateAppTask;
  }
}

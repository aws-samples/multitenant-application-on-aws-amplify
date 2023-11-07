/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 */

import { StackProps, Tags, RemovalPolicy, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { StateMachine, JsonPath, LogLevel } from 'aws-cdk-lib/aws-stepfunctions';
import { AwsCustomResource, AwsCustomResourcePolicy, PhysicalResourceId } from 'aws-cdk-lib/custom-resources';
import { AttributeType, GlobalSecondaryIndexProps, Table } from 'aws-cdk-lib/aws-dynamodb';
import { CallAwsService } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { tenantIds } from '../../config';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { NagSuppressions } from 'cdk-nag'

interface UpdateConstructProps extends StackProps {
  dataTable: Table;
  environment: string;
  solutionName: string;
  costcenter: string;
}

export class StateMachineUpdateGlobalSecondaryIndexesConstruct extends Construct {
  constructor(scope: Construct, id: string, props: UpdateConstructProps) {
    super(scope, id);

    // Define the DynamoDB table name
    const tableName = props.dataTable.tableName;

    // Define the Step Functions state machine
    const stateMachine = new StateMachine(this, 'GSIStateMachine', {
      definition: this.createStateMachineDefinition(tableName), // function at bottom on file
      tracingEnabled: true, 
      stateMachineName: `${props.solutionName}-gsi-deploy-sfn-${props.environment}`,
      logs: {
        destination: new LogGroup(this, "logGroup", {
          logGroupName: `/aws/vendedlogs/states/${props.solutionName}-gsi-deploy-sfn-${props.environment}`,
          removalPolicy: RemovalPolicy.DESTROY,
          retention: RetentionDays.ONE_WEEK, 
        }), 
        level: LogLevel.ALL,
        includeExecutionData: true 
      },
    });

    NagSuppressions.addResourceSuppressions(stateMachine, 
      [
        {
          id:'AwsSolutions-IAM5',
          reason: 'Needs access to write to CloudWatch Logs',
         // appliesTo: [`Resource::arn:aws:logs:::*`]
        },
      ],true)
  

    // Loop through the tenantIds array
    tenantIds.forEach((tenantId, index) => {
      // Define the DynamoDB GSI properties for the current tenantId
      const gsiProps: GlobalSecondaryIndexProps = {
        indexName: `${tenantId}-Index`,
        partitionKey: {
          name: 'tenantId',
          type: AttributeType.STRING,
        },
        sortKey: {
          name: 'updatedAt',
          type: AttributeType.STRING,
        },
      };

      // Invoke the Step Functions state machine for the current tenantId during CDK deploy
      const invokeStateMachine = new AwsCustomResource(this, `InvokeGSIStateMachine${index}`, {
        onCreate: {
          service: 'StepFunctions',
          action: 'startExecution',
          parameters: {
            stateMachineArn: stateMachine.stateMachineArn,
            input: JSON.stringify({ tableName, gsiProps }),
          },
          physicalResourceId: PhysicalResourceId.of(stateMachine.stateMachineArn),
        },
        policy: AwsCustomResourcePolicy.fromStatements([
          new PolicyStatement({
            actions: [`states:StartExecution`],
            resources: [stateMachine.stateMachineArn]
          })
    ]),
      });

    });

    Tags.of(this).add("environment", props.environment);
    Tags.of(this).add("solution", props.solutionName);
    Tags.of(this).add("costcenter", props.costcenter);
  }

  private createStateMachineDefinition(tableName: string) {
    const createGSITask = new CallAwsService(this, 'CreateGSITask', {
      service: 'DynamoDB',
      action: 'updateTable',
      comment: `create GSI for Tenant`, 
      parameters: {
        TableName: tableName,
        AttributeDefinitions: [
          {
            AttributeName: JsonPath.stringAt('$.gsiProps.partitionKey.name'),
            AttributeType: JsonPath.stringAt('$.gsiProps.partitionKey.type'),
          },
          {
            AttributeName: JsonPath.stringAt('$.gsiProps.sortKey.name'),
            AttributeType: JsonPath.stringAt('$.gsiProps.sortKey.type'),
          },
        ],
        GlobalSecondaryIndexUpdates: [
          {
            Create: {
              IndexName: JsonPath.stringAt('$.gsiProps.indexName'),
              KeySchema: [
                {
                  AttributeName: JsonPath.stringAt('$.gsiProps.partitionKey.name'),
                  KeyType: 'HASH',
                },
                {
                  AttributeName: JsonPath.stringAt('$.gsiProps.sortKey.name'),
                  KeyType: 'RANGE',
                },
              ],
              Projection: {
                ProjectionType: 'ALL',
              },
            },
          },
        ],
      },
      iamResources: ['*'],
    });

    createGSITask.addRetry({
      maxAttempts: 3, 
      interval: Duration.minutes(2), 
      errors: ['States.ALL'], 
      backoffRate: 2, 
    });


    return createGSITask;
  }
}

/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 */

import { StackProps, Tags} from 'aws-cdk-lib'
import { Construct } from 'constructs';
import {  UserPool} from 'aws-cdk-lib/aws-cognito'
import {  GraphqlApi,  AuthorizationType, SchemaFile,  FieldLogLevel,  MappingTemplate,  PrimaryKey,  Values, DynamoDbDataSource} from 'aws-cdk-lib/aws-appsync'
import { Table } from 'aws-cdk-lib/aws-dynamodb'
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Effect, PolicyDocument, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import * as path from 'path'
import { tenantIds } from '../../config';
import { NagSuppressions } from 'cdk-nag'

export interface IAppSyncProps extends StackProps{
  userPool: UserPool;
  dataTable: Table; 
  environment: string; 
  costcenter: string; 
  solutionName: string; 
}

export class AppsyncConstruct extends Construct {
  public readonly graphqlAPI: GraphqlApi;

  constructor(scope: Construct, id: string, props: IAppSyncProps) {
    super(scope, id);

    const dataApi = new GraphqlApi(this, 'DataAPI', {
      name: `${props.solutionName}-dataAPI-${props.environment}`,
      schema: SchemaFile.fromAsset(path.join(__dirname, 'schema.graphql')),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: AuthorizationType.USER_POOL,
          userPoolConfig: {
            userPool: props.userPool
          },
        },
      },
      logConfig: {
        fieldLogLevel: FieldLogLevel.ALL,
        retention: RetentionDays.ONE_DAY
      },
      xrayEnabled: true,
    })

    NagSuppressions.addResourceSuppressions(
      dataApi,
      [
        {
          id: 'AwsSolutions-IAM4',
          reason: 'Needs access to write to CloudWatch Logs'
        },
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
      ],
      true
    );
      
     const statements: PolicyStatement[] = [];

      tenantIds.forEach((tenantId) => {
        const statement = new PolicyStatement({
          effect: Effect.ALLOW,
          resources: [`${props.dataTable.tableArn}/index/${tenantId}-Index`],
          actions: [
            "dynamodb:BatchGetItem",
            "dynamodb:BatchWriteItem",
            "dynamodb:ConditionCheckItem",
            "dynamodb:DeleteItem",
            "dynamodb:DescribeTable",
            "dynamodb:GetItem",
            "dynamodb:GetRecords",
            "dynamodb:GetShardIterator",
            "dynamodb:PutItem",
            "dynamodb:Query",
            "dynamodb:Scan",
            "dynamodb:UpdateItem"
          ],
        });

        statements.push(statement);
      });

      const statement = new PolicyStatement({
        effect: Effect.ALLOW,
        resources: [`${props.dataTable.tableArn}/index/*`],
        actions: [
          "dynamodb:BatchGetItem",
          "dynamodb:BatchWriteItem",
          "dynamodb:ConditionCheckItem",
          "dynamodb:DeleteItem",
          "dynamodb:DescribeTable",
          "dynamodb:GetItem",
          "dynamodb:GetRecords",
          "dynamodb:GetShardIterator",
          "dynamodb:PutItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:UpdateItem"
        ],
      });
      statements.push(statement);


    const appsyncServiceRole = new Role(this, `AppSyncServiceRole`, {
      roleName: `${props.solutionName}-AppSyncService-Role-${props.environment}`,
      description: "AWS AppSync service linked role",
      assumedBy: new ServicePrincipal('appsync.amazonaws.com'),
      inlinePolicies: {
        dynamodbAccessPolicy : new PolicyDocument({
          assignSids:true,
          statements
        })
      }
      });

      NagSuppressions.addResourceSuppressions(
        [appsyncServiceRole],
        [
          {
            id: 'AwsSolutions-IAM4',
            reason: 'Needs access to write to CloudWatch Logs'
          },
          {
            id: 'AwsSolutions-IAM5',
            reason: 'Needs access to write access to all indexes scoped to specific Dynamodb table created by this solution'
          },
        ],
        true
      );
  

     const dataTableDS = new DynamoDbDataSource(this, "dataTable", {
      name: `${props.solutionName}-dataTableDS-${props.environment}`,
      api: dataApi, 
      table: props.dataTable,
      description: `${props.solutionName} Todo Table Data Sources`,
      serviceRole: appsyncServiceRole
     })
     

      dataTableDS.createResolver("QueryGetTodo",{
      typeName: 'Query',
      fieldName: 'getTodo',
      requestMappingTemplate: MappingTemplate.dynamoDbGetItem('id', 'id'),
      responseMappingTemplate: MappingTemplate.dynamoDbResultItem(),
    })

    dataTableDS.createResolver("QueryListTodos",{
      typeName: 'Query',
      fieldName: 'listTodos',
      requestMappingTemplate: MappingTemplate.fromFile(path.join(__dirname, './mapping-templates/todo-query-listTodos-resolver.vtl')),
      responseMappingTemplate: MappingTemplate.dynamoDbResultList(),
    })

    dataTableDS.createResolver("createTodo",{
    typeName: 'Mutation',
    fieldName: 'createTodo',
    requestMappingTemplate: MappingTemplate.dynamoDbPutItem(
      PrimaryKey.partition('id').auto(),
      Values.projecting('input')
    ),
    responseMappingTemplate: MappingTemplate.dynamoDbResultItem(),
  })


  dataTableDS.createResolver("updateTodo",{
    typeName: 'Mutation',
    fieldName: 'updateTodo',
    requestMappingTemplate: MappingTemplate.dynamoDbPutItem(
      PrimaryKey.partition('id').is('input.id'),
      Values.projecting('input')
    ),
    responseMappingTemplate: MappingTemplate.dynamoDbResultItem(),
  })


  dataTableDS.createResolver("deleteTodo",{
    typeName: 'Mutation',
    fieldName: 'deleteTodo',
    requestMappingTemplate: MappingTemplate.dynamoDbDeleteItem('id', 'id'),
    responseMappingTemplate: MappingTemplate.dynamoDbResultItem(),
  })

  dataTableDS.createResolver("onCreateTodo", {
    typeName: "Subscription",
    fieldName: "onCreateTodo",
    requestMappingTemplate: MappingTemplate.fromFile(path.join(__dirname, './mapping-templates/subscription-request-mapping-template.vtl')),
    responseMappingTemplate: MappingTemplate.fromFile(path.join(__dirname, './mapping-templates/subscription-response-mapping-template.vtl' )),
  });


 dataTableDS.createResolver("onUpdateTodo", {
  typeName: "Subscription",
  fieldName: "onUpdateTodo",
  requestMappingTemplate: MappingTemplate.fromFile(path.join(__dirname, './mapping-templates/subscription-request-mapping-template.vtl')),
  responseMappingTemplate: MappingTemplate.fromFile(path.join(__dirname, './mapping-templates/subscription-response-mapping-template.vtl' ))
  });


dataTableDS.createResolver("onDeleteTodo", {
  typeName: "Subscription",
  fieldName: "onDeleteTodo",
  requestMappingTemplate: MappingTemplate.fromFile(path.join(__dirname, './mapping-templates/subscription-request-mapping-template.vtl')),
  responseMappingTemplate: MappingTemplate.fromFile(path.join(__dirname, './mapping-templates/subscription-response-mapping-template.vtl' ))
});

  this.graphqlAPI = dataApi;
  
  Tags.of(this).add("environment", props.environment)
  Tags.of(this).add("solution", props.solutionName)
  Tags.of(this).add("costcenter", props.costcenter)

    
  }
}

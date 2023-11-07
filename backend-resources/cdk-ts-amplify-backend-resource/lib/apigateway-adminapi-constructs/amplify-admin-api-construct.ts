/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 */

import { StackProps, RemovalPolicy, Tags, Duration, Stack } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import {
  RestApi, EndpointType, MethodLoggingLevel, LogGroupLogDestination, AccessLogFormat, AccessLogField,
  LambdaIntegration, CognitoUserPoolsAuthorizer, AuthorizationType, RequestValidator, AwsIntegration
} from 'aws-cdk-lib/aws-apigateway';
import { IBucket } from 'aws-cdk-lib/aws-s3';
import { ITable} from 'aws-cdk-lib/aws-dynamodb';
import { IUserPool, IUserPoolClient,  } from 'aws-cdk-lib/aws-cognito';
import { Effect, ManagedPolicy, Policy, PolicyDocument, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Runtime, IFunction } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, SourceMapMode } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogLevel, StateMachine, JsonPath, Condition, Choice, Fail } from 'aws-cdk-lib/aws-stepfunctions';
import { CallAwsService, LambdaInvoke } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { names } from '../../config';
import * as path from 'path';
import { NagSuppressions } from 'cdk-nag'


export interface IGwyStackProps extends StackProps{
  isTenantUserCognitoGroupRole:Role
  adminTable: ITable;
  dataTable: ITable;
  userPool: IUserPool;
  userPoolClient: IUserPoolClient;
  storageBucket: IBucket; 
  environment: string; 
  costcenter: string; 
  solutionName: string; 
}

export class AmplifyAdminApi extends Construct {

  public readonly adminApi: RestApi;

  constructor(scope: Construct, id: string, props: IGwyStackProps) {
    super(scope, id);

    const AdminQueriesFunctionRole = new Role(this, `AdminQueries-LambdaRole`, {
      roleName: `${props.solutionName}-adminQueries-${props.environment}`,
      description: "Handles Amplify Admin Queries Against the Cognito API",
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole")
      ],
      inlinePolicies: {
        LambdaInlinePolicy: new PolicyDocument({
          assignSids:true,
          statements: [
            new PolicyStatement({
              effect: Effect.ALLOW,
              resources: [
                props.adminTable.tableArn, 
                props.userPool.userPoolArn,
                props.storageBucket.bucketArn,
                `${props.storageBucket.bucketArn}/*`
              ],
              actions: [
                "cognito-idp:ListUsersInGroup",
                "cognito-idp:ListGroups",
                "cognito-idp:AdminAddUserToGroup",
                "cognito-idp:AdminCreateUser",
                "dynamodb:Scan",
                "dynamodb:PutItem",
                "dynamodb:UpdateItem",
                "s3:GetObject",
                "s3:PutObject",
                "s3:PutObjectAcl",
                "s3:ListBucket"
              ],
            }),
          ],
        })
      }
    });

    NagSuppressions.addResourceSuppressions(
      AdminQueriesFunctionRole,
      [
        {
          id: 'AwsSolutions-IAM4',
          reason: 'Needs access to write to CloudWatch Logs'
        },
        {
          id: 'AwsSolutions-IAM5',
          reason: 'Provides access to specific bucket and files within'
        },
      ],
      true
    );

      ///Admin API Lambda 
      const proxyHandler = new NodejsFunction(this, 'admin api lambda', {
        functionName: `${props.solutionName}-adminapi-${props.environment}`,
        runtime: Runtime.NODEJS_18_X,
        memorySize: 1024,
        timeout: Duration.minutes(3),
        handler: 'handler',
        role: AdminQueriesFunctionRole, 
        entry: path.join(__dirname, '../lambda-code/admin-rest-api/index.ts' ),
        depsLockFilePath: path.join(__dirname, '../lambda-code/admin-rest-api/package-lock.json'),
        environment: {
          "USERPOOL": `${props.userPool.userPoolId}`,
          "GROUP": names.cognitoGlobalAdminGroupName,
          "ENV": props.environment,
          "tableName": props.adminTable.tableName, 
        },
        bundling: {
          externalModules: ['aws-lambda'],
          nodeModules: [
            'aws-sdk',
            '@aws-sdk/client-dynamodb', 
            "express", 
            "aws-serverless-express", 
            "body-parser",
          ],
           minify: true, 
          sourceMap: true, 
          sourceMapMode: SourceMapMode.INLINE, 
          sourcesContent: false, 
          target: 'es2020', 
        },
      }); 
      
      proxyHandler.applyRemovalPolicy(RemovalPolicy.DESTROY);

      
    // create Cognito User Pool authorizer for integration with API Gateway
    const authorizer = new CognitoUserPoolsAuthorizer(this, 'cognito-authorizer', {
      cognitoUserPools: [props.userPool],
      identitySource: 'method.request.header.Authorization',
      authorizerName: `${props.solutionName}-Cognito-Authorizer-${props.environment}`,
    });



    //Setup  API Gateway ============================================
    const adminApi = new RestApi(this, 'AmplifyAdminApi', {
      restApiName: `${props.solutionName}-AdminQueries-${props.environment}`,
      description: "Amplify Admin Queries API",
      deploy: true, 
     cloudWatchRole: true, 
     cloudWatchRoleRemovalPolicy: RemovalPolicy.DESTROY,  
     defaultMethodOptions: {
      authorizer,
      authorizationType: AuthorizationType.COGNITO
     },
      deployOptions: {
          stageName: props.environment,
          description: `${props.solutionName} ${props.environment} Deployment`,
          /**
           * Enable tracing and logging in JSON format for the API.
           */
          dataTraceEnabled: true,
          tracingEnabled: true,
          accessLogDestination: new LogGroupLogDestination(new LogGroup(this, 'AccessLog', {
              retention: RetentionDays.ONE_DAY,
              removalPolicy: RemovalPolicy.DESTROY,
          })),
          accessLogFormat: AccessLogFormat.custom(JSON.stringify({
              requestTime: AccessLogField.contextRequestTime(),
              requestTimeEpoch: AccessLogField.contextRequestTimeEpoch(),
              requestId: AccessLogField.contextRequestId(),
              extendedRequestId: AccessLogField.contextExtendedRequestId(),
              sourceIp: AccessLogField.contextIdentitySourceIp(),
              method: AccessLogField.contextHttpMethod(),
              resourcePath: AccessLogField.contextResourcePath(),
              traceId: AccessLogField.contextXrayTraceId(),
          })),
          /**
           * Execution logs.
           * Instrumental for debugging.
           */
          loggingLevel: MethodLoggingLevel.ERROR,
          /**
           * Enable Details Metrics. Additional costs incurred
           * Creates metrics at the method level.
           */
          metricsEnabled: true
      },
               
        defaultCorsPreflightOptions: {
          allowHeaders: [
            "Content-Type",
            "X-Amz-Date",
            "Authorization",
            "X-Api-Key",
            "x-amz-security-token",
          ],
          allowMethods: ["OPTIONS", "GET", "POST", "PUT", "PATCH", "HEAD", "DELETE"],
          allowCredentials: true,
          //allowOrigins: Cors.ALL_ORIGINS,
          allowOrigins: ["*"],
        },  
      endpointTypes: [EndpointType.REGIONAL],
    });

    const requestValidator = new RequestValidator(this, 'RequestValidator', {
      restApi: adminApi,
      requestValidatorName: `${props.solutionName}-requestValidator`,
      validateRequestParameters: true,
      validateRequestBody: true  //AwsSolutions-APIG2 
    }); 

    
    // Admin API Resource for Cognito Admin Methods
    const adminRoute = adminApi.root.addResource('admin')
    const adminProxy = adminRoute.addResource('{proxy+}')
    adminProxy.addMethod('ANY', new LambdaIntegration(proxyHandler, { 
      proxy: true,  
      cacheKeyParameters: ["method.request.path.proxy"]
    }),{
        authorizationType: AuthorizationType.COGNITO,
        authorizer: authorizer,
        requestParameters: {
          'method.request.header.Authorization': true,
          'method.request.path.proxy': true,
        },
        requestValidator: requestValidator, 

      }
     ); 
  
 
    // Resource path for creating new tenants 
    const tenantResource = adminApi.root.addResource('tenancy');
    const newTenant = tenantResource.addResource('new')

    // Function role: 
    const createUserPoolGroupFunctionRole = new Role(this, `cognito-user-Pool-Group-LambdaRole`, {
      roleName: `${props.solutionName}-CreateCognitoGroupLambdaRole-${props.environment}`,
      description: "Creates UserPool Group",
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole")
      ],
      inlinePolicies: {
        AddGroupPolicy: new PolicyDocument({
          assignSids:true,
          statements: [
            new PolicyStatement({
              effect: Effect.ALLOW,
              resources: [
                props.userPool.userPoolArn,
                props.isTenantUserCognitoGroupRole.roleArn
              ],
              actions: [
                "cognito-idp:CreateGroup",
                "cognito-idp:DeleteGroup",
                "iam:PassRole"
              ],
            }),
          ],
        }),
      }
    });

    const createUserPoolGroupLambda = new NodejsFunction(this,'createUserPoolGroup',{
      functionName: `${props.solutionName}-create-group-${props.environment}`,
      runtime: Runtime.NODEJS_18_X, 
      entry: path.join(__dirname, '../lambda-code/statemachine-functions/adminCreateUserPoolGroupLambda/index.ts'),
      depsLockFilePath: path.join(__dirname, '../lambda-code/statemachine-functions/adminCreateUserPoolGroupLambda/package-lock.json'),
      handler: 'handler',
      role: createUserPoolGroupFunctionRole,
      environment: {  
        tenantGroupRoleArn: props.isTenantUserCognitoGroupRole.roleArn,
        precedence: "10",
        userPoolId: props.userPool.userPoolId
      },
      bundling: {
        externalModules: [
         // '@aws-sdk/*'
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

    ///Admin Group Check Lambda 
    const extractCognitoGroupsLambda = new NodejsFunction(this, 'extract-cognito-groups-lambda', {
      functionName: `${props.solutionName}-extract-cognito-groups-${props.environment}`,
      runtime: Runtime.NODEJS_18_X,
      memorySize: 1024,
      timeout: Duration.minutes(1),
      handler: 'handler',
      role: AdminQueriesFunctionRole, 
      entry: path.join(__dirname, '../lambda-code/statemachine-functions/extract-cognito-groups/index.ts' ),
      depsLockFilePath: path.join(__dirname, '../lambda-code/statemachine-functions/extract-cognito-groups/package-lock.json'),
      environment: {
          "USERPOOLID": `${props.userPool.userPoolId}`,
          "GLOBALADMINGROUP": names.cognitoGlobalAdminGroupName,
          "CLIENTID": `${props.userPoolClient.userPoolClientId}`
      },
      bundling: {
        externalModules: ['aws-lambda'],
        nodeModules: [
          'aws-sdk',
          'jsonwebtoken', 
          'aws-jwt-verify'
        ],
        minify: true, 
        sourceMap: true, 
        sourceMapMode: SourceMapMode.INLINE, 
        sourcesContent: false, 
        target: 'es2020', 
      }
    }); 
    
    extractCognitoGroupsLambda.applyRemovalPolicy(RemovalPolicy.DESTROY);

    const createNewTenantStateMachineRole = new Role(this, `createNewTenantStateMachineRole`, {
      roleName: `${props.solutionName}-NewTenantSfn-${props.environment}`,
      description: "Create New Tenant StateMachine Role",
      assumedBy: new ServicePrincipal('states.amazonaws.com'),
      inlinePolicies: {
        UpdateDynamodbTablePolicy: new PolicyDocument({
          assignSids:true,
          statements: [
            new PolicyStatement({
              effect: Effect.ALLOW,
              resources: [
                props.dataTable.tableArn,
              ],
              actions: [
                "DynamoDB:updateTable"
              ],
            }),
          ],
        }),
        InvokeLambdaPolicy: new PolicyDocument({
          assignSids:true,
          statements: [
            new PolicyStatement({
              effect: Effect.ALLOW,
              resources: [
                createUserPoolGroupLambda.functionArn,
                extractCognitoGroupsLambda.functionArn,
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

      // Create New Tenant Step Function 
      const createNewTenantStateMachine = new StateMachine(this, 'StateMachine', {
        stateMachineName: `${props.solutionName}-create-new-tenant-${props.environment}`, 
        definition: this.createStateMachineDefinition(props.dataTable.tableName, createUserPoolGroupLambda, extractCognitoGroupsLambda),
       role: createNewTenantStateMachineRole,
       tracingEnabled: true, 
        logs: {
          destination: new LogGroup(this, "create-new-tenant-logGroup", {
            logGroupName: `/aws/vendedlogs/states/${props.solutionName}-new-tenant-sfn-${props.environment}`,
            removalPolicy: RemovalPolicy.DESTROY,
            retention: RetentionDays.ONE_DAY, 
          }), 
          level: LogLevel.ALL,
          includeExecutionData: true
        },

      });

        // Api Gateway Direct Integration
      const invokeStateMachineRole = new Role(this, "StartExecution", {
        assumedBy: new ServicePrincipal("apigateway.amazonaws.com"),
      });
      invokeStateMachineRole.attachInlinePolicy(
          new Policy(this, "StartExecutionPolicy", {
              statements: [
                  new PolicyStatement({
                      actions: ["states:StartExecution"],
                      effect: Effect.ALLOW,
                      resources: [createNewTenantStateMachine.stateMachineArn],
                  }),
              ],
          })
      );


      // Set up the API Gateway integration with the Step Function state machine
      newTenant.addMethod('POST', 
      new AwsIntegration({
        service: 'states',
        action: 'StartExecution',
        integrationHttpMethod: 'POST', 
        options: {
          credentialsRole: invokeStateMachineRole,
          requestTemplates: {
            "application/json": `
            #set($input = $input.json('$'))
            {
              "input": "$util.escapeJavaScript($input).replaceAll("\\\\'", "'")",
              "stateMachineArn": "${createNewTenantStateMachine.stateMachineArn}"
            }`,
          },
          integrationResponses: [
            {
                statusCode: "200",
                responseParameters: {
                  'method.response.header.Access-Control-Allow-Headers': "'Content-Type'",
                  'method.response.header.Access-Control-Allow-Origin': "'*'",
                  'method.response.header.Access-Control-Allow-Methods': "'OPTIONS,POST,GET'"
                },
            },
            {
                statusCode: "500",
                responseTemplates: {
                    "application/json": `{"status": "conversion request failed"}`,
                },
            }
        ],
        }
      }),
      {
        authorizationType: AuthorizationType.COGNITO,
        authorizer: authorizer,
        requestParameters: {
          'method.request.header.Authorization': true,
        },
        requestValidator: requestValidator,  
        methodResponses: [
          {  
            statusCode: '200',
            responseParameters: {
              'method.response.header.Access-Control-Allow-Headers': true,
              'method.response.header.Access-Control-Allow-Origin': true,
              'method.response.header.Access-Control-Allow-Methods': true,
            },
          }, 
          { statusCode: '500'  }
        ],
      }, 
      
      )

    this.adminApi = adminApi 


        NagSuppressions.addResourceSuppressions(
          [adminApi, adminRoute, adminProxy,createUserPoolGroupFunctionRole, createNewTenantStateMachine, createNewTenantStateMachineRole], 
        [
          {
            id: 'AwsSolutions-APIG4',
            reason: 'Authentication not configurable on OPTIONS carrying CORS configuration'
          },
          {
            id: 'AwsSolutions-COG4',
            reason: 'Authentication not configurable on OPTIONS carrying CORS configuration'
          },
          {
            id: 'AwsSolutions-IAM4',
            reason: 'Needs access to write to CloudWatch Logs',
          },
          {
            id: 'AwsSolutions-IAM5',
            reason: 'StateMachine Creates Default policy providing region & account bounded access to write to CloudWatch Logs',
          },
        ],true)
    


    Tags.of(this).add("environment", props.environment)
    Tags.of(this).add("solution", props.solutionName)
    Tags.of(this).add("costcenter", props.costcenter)

  }

  //Create New Tenant Step Function Definition 
  private createStateMachineDefinition(dataTableName: string, createUserPoolGroupLambda: IFunction, extractCognitoGroupsLambda: IFunction) {

    // This lambda extracts the 'cognito:groups' from the JWT
    const extractCognitoGroupsTask = new LambdaInvoke(this, 'Extract Cognito Groups', {
      lambdaFunction: extractCognitoGroupsLambda,
      resultPath: JsonPath.stringAt('$.extractCognitoGroupsTaskOutput')
    });

    const createGSITask = new CallAwsService(this, 'CreateGSITask', {
      service: 'DynamoDB',
      action: 'updateTable',
      comment: `create GSI for Tenant`, 
      parameters: {
        TableName: dataTableName,
        AttributeDefinitions: [
          {
            AttributeName: "tenantId",
            AttributeType: "S",
          },
          {
            AttributeName: "updatedAt",
            AttributeType: "S",
          },
        ],
        GlobalSecondaryIndexUpdates: [
          {
            Create: {
              IndexName: JsonPath.stringAt('$.gsiProps.indexName'),
              KeySchema: [
                {
                  AttributeName: "tenantId",
                  KeyType: 'HASH',
                },
                {
                  AttributeName: "updatedAt",
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
      iamResources: [
        `arn:aws:dynamodb:${Stack.of(this).region}:${Stack.of(this).account}:table/${dataTableName}`,
        `arn:aws:dynamodb:${Stack.of(this).region}:${Stack.of(this).account}:table/${dataTableName}/*`
      ],
      resultPath: JsonPath.stringAt('$.createGsiOutput')
    });
    
    createGSITask.addRetry({
      maxAttempts: 3, 
      interval: Duration.minutes(2), 
      errors: ['States.ALL'], 
      backoffRate: 2, 
    });
    
 
    const createCognitoGroupTask = new LambdaInvoke(this, 'Invoke Lambda Function to Create New User Pool Group', {
        lambdaFunction: createUserPoolGroupLambda
      })
      
        // Choice state to check for 'GlobalAdmins'
        const checkGlobalAdminsChoice = new Choice(this, 'Is Global Admin?', {comment: "Global Admin Check"}
        ).when(Condition.stringEquals(JsonPath.stringAt('$.extractCognitoGroupsTaskOutput.Payload.group'),names.cognitoGlobalAdminGroupName),
        createGSITask.next(createCognitoGroupTask)).otherwise(new Fail(this, 'Fail', { cause: 'Not a GlobalAdmin' }));
          
          extractCognitoGroupsTask.next(checkGlobalAdminsChoice)

        return extractCognitoGroupsTask
  }

}
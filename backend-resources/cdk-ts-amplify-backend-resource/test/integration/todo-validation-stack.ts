/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 */

import {
  App, BootstraplessSynthesizer, CfnOutput, RemovalPolicy, Stack, StackProps, Tags,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { UserPool, StringAttribute } from 'aws-cdk-lib/aws-cognito';
import { AttributeType, BillingMode, ProjectionType, Table } from 'aws-cdk-lib/aws-dynamodb';
import { AuthorizationType, GraphqlApi, SchemaFile } from 'aws-cdk-lib/aws-appsync';
import { parseArgs } from 'node:util';
import * as path from 'path';
import { addTodoResolvers } from '../../lib/appsync-construct-resources/todo-resolvers';
import { createAppClientAttributes } from '../../lib/cognito-constructs/user-pool-client-construct';
import { tenantIds } from '../../config';

export const validationPurpose = 'todo-authorization-validation';

export class TodoValidationStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, { ...props, synthesizer: new BootstraplessSynthesizer() });
    if (!/^todo-auth-validation-[a-z0-9-]+$/.test(this.stackName)) {
      throw new Error('Use a dedicated todo-auth-validation-* stack name.');
    }
    const pool = new UserPool(this, 'Users', {
      selfSignUpEnabled: false,
      signInAliases: { username: true },
      signInCaseSensitive: false,
      standardAttributes: {
        email: { required: true, mutable: true },
        preferredUsername: { required: true, mutable: true },
      },
      customAttributes: {
        role: new StringAttribute({ mutable: true }),
        isAdmin: new StringAttribute({ mutable: true }),
        tenantId: new StringAttribute({ mutable: false }),
      },
      passwordPolicy: {
        minLength: 16, requireDigits: true, requireLowercase: true,
        requireUppercase: true, requireSymbols: true,
      },
      removalPolicy: RemovalPolicy.DESTROY,
    });
    const client = pool.addClient('Client', {
      generateSecret: false,
      authFlows: { userPassword: true },
      ...createAppClientAttributes(),
    });
    const table = new Table(this, 'Todos', {
      partitionKey: { name: 'id', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    for (const tenant of tenantIds) {
      table.addGlobalSecondaryIndex({
        indexName: `${tenant}-Index`,
        partitionKey: { name: 'tenantId', type: AttributeType.STRING },
        sortKey: { name: 'updatedAt', type: AttributeType.STRING },
        projectionType: ProjectionType.ALL,
      });
    }
    const api = new GraphqlApi(this, 'Api', {
      name: this.stackName,
      schema: SchemaFile.fromAsset(path.join(
        __dirname, '../../lib/appsync-construct-resources/schema.graphql'
      )),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: AuthorizationType.USER_POOL,
          userPoolConfig: { userPool: pool },
        },
      },
    });
    addTodoResolvers(api, api.addDynamoDbDataSource('Todos', table));
    Tags.of(this).add('purpose', validationPurpose);
    Tags.of(this).add('environment', 'validation');
    new CfnOutput(this, 'ValidationPurpose', { value: validationPurpose });
    new CfnOutput(this, 'AccountId', { value: this.account });
    new CfnOutput(this, 'UserPoolId', { value: pool.userPoolId });
    new CfnOutput(this, 'UserPoolClientId', { value: client.userPoolClientId });
    new CfnOutput(this, 'GraphqlUrl', { value: api.graphqlUrl });
    new CfnOutput(this, 'GraphqlApiId', { value: api.apiId });
    new CfnOutput(this, 'TodoTableName', { value: table.tableName });
  }
}

if (require.main === module) {
  const { values } = parseArgs({
    options: {
      account: { type: 'string' }, region: { type: 'string' },
      'stack-name': { type: 'string' }, output: { type: 'string' },
    },
  });
  const { account, region, output } = values;
  const stackName = values['stack-name'];
  if (!account || !/^\d{12}$/.test(account) || !region || !output || !stackName) {
    throw new Error('Provide --account, --region, --stack-name and --output.');
  }
  const app = new App({ outdir: path.resolve(output) });
  new TodoValidationStack(app, stackName, {
    stackName, env: { account, region },
  });
  app.synth();
  console.log(`Synthesized temporary validation stack: ${stackName}`);
}

/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 */

import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { TodoValidationStack } from './integration/todo-validation-stack';

describe('isolated live-validation stack', () => {
  const app = new App();
  const stack = new TodoValidationStack(app, 'todo-auth-validation-offline', {
    stackName: 'todo-auth-validation-offline',
  });
  const template = Template.fromStack(stack);

  test('rejects an unrelated stack name', () => {
    expect(() => new TodoValidationStack(new App(), 'Unrelated', {
      stackName: 'customer-app',
    })).toThrow('dedicated todo-auth-validation');
  });

  test('uses Cognito authentication and deploys the shared eight resolvers', () => {
    template.hasResourceProperties('AWS::AppSync::GraphQLApi', {
      AuthenticationType: 'AMAZON_COGNITO_USER_POOLS',
    });
    template.resourceCountIs('AWS::AppSync::Resolver', 8);
    template.resourceCountIs('AWS::AppSync::ApiKey', 0);
  });

  test('does not deploy the frontend, custom code, or shared bootstrap resources', () => {
    expect(template.toJSON().Parameters?.BootstrapVersion).toBeUndefined();
    for (const type of [
      'AWS::Amplify::App', 'AWS::Lambda::Function', 'AWS::S3::Bucket',
      'AWS::Cognito::IdentityPool', 'AWS::Cognito::UserPoolDomain',
    ]) {
      template.resourceCountIs(type, 0);
    }
  });

  test('uses the actual sample app-client protections', () => {
    const client = Object.values(template.findResources('AWS::Cognito::UserPoolClient'))[0];
    expect(client.Properties.ReadAttributes).toContain('preferred_username');
    expect(client.Properties.WriteAttributes).toContain('preferred_username');
    for (const claim of ['custom:tenantId', 'custom:role', 'custom:isAdmin']) {
      expect(client.Properties.WriteAttributes).not.toContain(claim);
    }
  });

  test('disables self sign-up and tags disposable resources for validation', () => {
    template.hasResourceProperties('AWS::Cognito::UserPool', {
      AdminCreateUserConfig: { AllowAdminCreateUserOnly: true },
    });
    const table = Object.values(template.findResources('AWS::DynamoDB::Table'))[0];
    expect(table.DeletionPolicy).toBe('Delete');
    expect(table.Properties.Tags).toContainEqual({
      Key: 'purpose', Value: 'todo-authorization-validation',
    });
    expect(table.Properties.GlobalSecondaryIndexes.map((index: any) => index.IndexName))
      .toEqual(['TenantA-Index', 'TenantB-Index']);
  });
});

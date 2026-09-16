/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 */

import { Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { UserPoolClientConstruct } from '../lib/cognito-constructs/user-pool-client-construct';

test('authorization attributes are readable but not user-writable', () => {
  const stack = new Stack();
  const userPool = new cognito.UserPool(stack, 'UserPool', {
    customAttributes: {
      role: new cognito.StringAttribute({ mutable: true }),
      isAdmin: new cognito.StringAttribute({ mutable: true }),
      tenantId: new cognito.StringAttribute({ mutable: false }),
    },
  });

  new UserPoolClientConstruct(stack, 'UserPoolClient', {
    userPool,
    defaultDomain: 'https://example.com',
    environment: 'test',
    solutionName: 'test-solution',
    costcenter: 'test',
  });

  const resources = Template.fromStack(stack).findResources(
    'AWS::Cognito::UserPoolClient'
  );
  const client = Object.values(resources)[0] as {
    Properties: {
      ReadAttributes: string[];
      WriteAttributes: string[];
    };
  };

  expect(client.Properties.ReadAttributes).toEqual(
    expect.arrayContaining(['custom:role', 'custom:isAdmin', 'custom:tenantId'])
  );
  expect(client.Properties.WriteAttributes).not.toEqual(
    expect.arrayContaining(['custom:role', 'custom:isAdmin', 'custom:tenantId'])
  );
});

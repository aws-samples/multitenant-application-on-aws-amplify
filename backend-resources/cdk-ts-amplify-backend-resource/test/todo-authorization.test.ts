/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 */

import { Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { UserPool } from 'aws-cdk-lib/aws-cognito';
import { Table, AttributeType } from 'aws-cdk-lib/aws-dynamodb';
import { AppsyncConstruct } from '../lib/appsync-construct-resources/appsync-construct';
import { applyUpdate, conditionMatches, fromDynamo, render } from './helpers/vtl';

const alice = {
  sub: 'subject-alice',
  username: 'alice',
  claims: { 'custom:tenantId': 'TenantA', preferred_username: 'alice-display' },
};
const bob = {
  sub: 'subject-bob',
  username: 'bob',
  claims: { 'custom:tenantId': 'TenantA', preferred_username: 'bob-display' },
};
const outsider = {
  sub: 'subject-outsider',
  username: 'alice',
  claims: { 'custom:tenantId': 'TenantB', preferred_username: 'alice' },
};
const todo = {
  id: 'existing-id',
  tenantId: 'TenantA',
  sub: 'subject-alice',
  owners: ['alice', 'bob'],
  createdAt: '2026-11-01',
  updatedAt: '2026-11-01',
  content: 'Original',
  isDone: 'false',
};
const requestContext = (identity: any = alice, input: any = {}) => ({
  identity,
  args: { id: todo.id, input: { id: todo.id, ...input } },
});
const responseContext = (identity: any = alice, result: any = todo) => ({
  identity, result,
});

describe('all todo entry points fail closed', () => {
  const templates = [
    'todo-create-request.vtl', 'todo-get-request.vtl', 'todo-update-request.vtl',
    'todo-delete-request.vtl', 'todo-item-response.vtl',
    'todo-query-listTodos-resolver.vtl', 'subscription-request-mapping-template.vtl',
    'subscription-response-mapping-template.vtl',
  ];
  const invalidIdentities: [string, any][] = [
    ['anonymous', null],
    ['missing tenant', { ...alice, claims: { preferred_username: 'alice' } }],
    ['missing owner', { ...alice, username: undefined }],
    ['missing subject', { username: alice.username, claims: alice.claims }],
    ['blank owner', { ...alice, username: ' ' }],
    ['non-string tenant', { ...alice, claims: { ...alice.claims, 'custom:tenantId': ['TenantA'] } }],
  ];
  describe.each(templates)('%s', (template) => {
    test.each(invalidIdentities)('denies %s', (_name, identity) => {
      expect(() => render(template, {
        ...requestContext(identity), result: todo,
      })).toThrow('Unauthorized');
    });
  });
});

describe('creation', () => {
  test('accepts the legacy display-name hint but stores the immutable username', () => {
    const request = render('todo-create-request.vtl',
      requestContext(alice, { owners: ['alice-display'], content: 'New' })).value;
    expect(fromDynamo(request.attributeValues.owners)).toEqual(['alice']);
  });

  test('derives identity and dates on the server and generates a new id', () => {
    const request = render('todo-create-request.vtl', requestContext(alice, {
      tenantId: 'TenantA', sub: alice.sub, owners: ['alice'],
      content: 'New', isDone: 'false',
      createdAt: '1900-01-01', updatedAt: '1900-01-01',
    })).value;
    expect(request.operation).toBe('PutItem');
    expect(fromDynamo(request.key.id)).toBe('server-generated-id');
    const item = Object.fromEntries(Object.entries(request.attributeValues).map(
      ([key, value]) => [key, fromDynamo(value)]
    ));
    expect(item).toEqual({
      tenantId: 'TenantA', sub: alice.sub, owners: ['alice'],
      content: 'New', isDone: 'false',
      createdAt: '2026-11-07', updatedAt: '2026-11-07',
    });
    expect(conditionMatches(request.condition, undefined)).toBe(true);
    expect(conditionMatches(request.condition, todo)).toBe(false);
  });

  test.each([
    { tenantId: 'TenantB' },
    { sub: 'another-subject' },
    { owners: ['bob'] },
    { owners: ['alice', 'bob'] },
  ])('rejects forged creation fields: %j', (input) => {
    expect(() => render('todo-create-request.vtl',
      requestContext(alice, input))).toThrow('Unauthorized');
  });

  test('supports a minimal content-only input', () => {
    const request = render('todo-create-request.vtl',
      requestContext(alice, { content: 'New' })).value;
    expect(fromDynamo(request.attributeValues.owners)).toEqual(['alice']);
  });

  test('rejects an absent input', () => {
    expect(() => render('todo-create-request.vtl', {
      identity: alice, args: { input: null },
    })).toThrow('BadRequest');
  });
});

describe.each(['todo-update-request.vtl', 'todo-delete-request.vtl'])(
  'atomic authorization in %s', (template) => {
    const requestFor = (identity: any) => render(template, requestContext(identity)).value;

    test('permits the creator and a same-tenant co-owner', () => {
      expect(conditionMatches(requestFor(alice).condition, todo)).toBe(true);
      expect(conditionMatches(requestFor(bob).condition, todo)).toBe(true);
    });

    test('denies a different tenant even when the username matches', () => {
      expect(conditionMatches(requestFor(outsider).condition, todo)).toBe(false);
    });

    test('denies a same-tenant user who is not an owner', () => {
      const carol = { ...alice, username: 'carol' };
      expect(conditionMatches(requestFor(carol).condition, todo)).toBe(false);
    });

    test('denies a nonexistent item', () => {
      expect(conditionMatches(requestFor(alice).condition, undefined)).toBe(false);
    });

    test('rechecks ownership after a concurrent revocation', () => {
      const request = requestFor(bob);
      expect(conditionMatches(request.condition, { ...todo, owners: ['alice'] })).toBe(false);
    });

    test('rechecks tenant after a concurrent change', () => {
      const request = requestFor(alice);
      expect(conditionMatches(request.condition, { ...todo, tenantId: 'TenantB' })).toBe(false);
    });
  }
);

describe('updates and sharing', () => {
  test('preserves identity and fields omitted from a partial update', () => {
    const request = render('todo-update-request.vtl', requestContext(bob, {
      tenantId: 'TenantA', sub: 'forged-creator', createdAt: '1900-01-01',
      isDone: 'true',
    })).value;
    expect(request.operation).toBe('UpdateItem');
    expect(applyUpdate(request.update, todo)).toEqual({
      ...todo, updatedAt: '2026-11-07', isDone: 'true',
    });
  });

  test('supports the existing frontend sharing payload from a co-owner', () => {
    const request = render('todo-update-request.vtl', requestContext(bob, {
      ...todo, owners: ['alice', 'bob', 'carol'],
    })).value;
    expect(conditionMatches(request.condition, todo)).toBe(true);
    expect(applyUpdate(request.update, todo)).toEqual({
      ...todo, updatedAt: '2026-11-07', owners: ['alice', 'bob', 'carol'],
    });
  });

  test('cannot turn sharing into a tenant move', () => {
    expect(() => render('todo-update-request.vtl',
      requestContext(alice, { tenantId: 'TenantB' }))).toThrow('Unauthorized');
  });

  test.each([null, [], ['bob'], ['alice', null], ['alice', ' '], Array(51).fill('alice')])(
    'rejects an invalid owner list: %j', (owners) => {
      expect(() => render('todo-update-request.vtl',
        requestContext(alice, { owners }))).toThrow('BadRequest');
    }
  );

  test('rejects a missing update id', () => {
    expect(() => render('todo-update-request.vtl',
      requestContext(alice, { id: null }))).toThrow('BadRequest');
  });
});

describe('item responses', () => {
  test('a changed display name cannot impersonate an existing owner', () => {
    const impersonator = {
      ...alice, username: 'carol',
      claims: { ...alice.claims, preferred_username: 'alice' },
    };
    expect(() => render('todo-item-response.vtl',
      responseContext(impersonator))).toThrow('Unauthorized');
  });
  test('permits a same-tenant co-owner', () => {
    expect(render('todo-item-response.vtl', responseContext(bob)).value).toEqual(todo);
  });

  test('denies a cross-tenant read', () => {
    expect(() => render('todo-item-response.vtl',
      responseContext(outsider))).toThrow('Unauthorized');
  });

  test('denies a read when the caller is not an owner', () => {
    expect(() => render('todo-item-response.vtl',
      responseContext(alice, { ...todo, owners: ['bob'] }))).toThrow('Unauthorized');
  });

  test('denies a record without ownership metadata', () => {
    expect(() => render('todo-item-response.vtl',
      responseContext(alice, { ...todo, owners: null }))).toThrow('Unauthorized');
  });

  test('returns null for a missing item', () => {
    expect(render('todo-item-response.vtl', responseContext(alice, null)).value).toBeNull();
  });

  test('does not return the item carried by a failed DynamoDB condition', () => {
    expect(() => render('todo-item-response.vtl', {
      ...responseContext(outsider),
      error: { type: 'DynamoDB:ConditionalCheckFailedException', data: todo },
    })).toThrow('Unauthorized');
  });

  test('does not disclose an arbitrary backend error or its data', () => {
    expect(() => render('todo-item-response.vtl', {
      ...responseContext(),
      error: { type: 'InternalFailure', message: 'sensitive backend detail', data: todo },
    })).toThrow(/^TodoOperationFailed: Unable to complete todo request/);
  });

  test('uses a strongly consistent item read', () => {
    expect(render('todo-get-request.vtl', requestContext()).value.consistentRead).toBe(true);
  });
});

describe('lists and subscriptions', () => {
  test('scopes a list to the caller tenant and owner', () => {
    const request = render('todo-query-listTodos-resolver.vtl', requestContext()).value;
    expect(request.index).toBe('TenantA-Index');
    expect(fromDynamo(request.query.expressionValues[':tenantId'])).toBe('TenantA');
    expect(fromDynamo(request.filter.expressionValues[':owner'])).toBe('alice');
  });

  test('escapes quotes in a username without changing its filter value', () => {
    const identity = {
      ...alice, username: 'a"b\\c',
    };
    const request = render('todo-query-listTodos-resolver.vtl', requestContext(identity)).value;
    expect(fromDynamo(request.filter.expressionValues[':owner'])).toBe('a"b\\c');
  });

  test('registers without a database operation', () => {
    expect(render('subscription-request-mapping-template.vtl',
      requestContext()).value).toEqual({ version: '2018-05-29', payload: null });
  });

  test('filters subscription events by tenant AND owner and returns no item', () => {
    const response = render('subscription-response-mapping-template.vtl', responseContext());
    expect(response.value).toBeNull();
    expect(response.filters).toEqual([{
      filterGroup: [{
        filters: [
          { fieldName: 'tenantId', operator: 'eq', value: 'TenantA' },
          { fieldName: 'owners', operator: 'contains', value: 'alice' },
        ],
      }],
    }]);
  });
});

describe('deployed resolver configuration', () => {
  const stack = new Stack(undefined, 'TodoSecurityTest');
  const userPool = new UserPool(stack, 'UserPool');
  const table = new Table(stack, 'Todos', {
    partitionKey: { name: 'id', type: AttributeType.STRING },
  });
  const construct = new AppsyncConstruct(stack, 'Api', {
    userPool, dataTable: table, environment: 'test',
    costcenter: 'test', solutionName: 'todo-security-test',
  });
  const template = Template.fromStack(stack);
  const resolvers = Object.values(template.findResources('AWS::AppSync::Resolver')) as any[];

  test('retains Cognito authentication and all eight resolvers', () => {
    template.hasResourceProperties('AWS::AppSync::GraphQLApi', {
      AuthenticationType: 'AMAZON_COGNITO_USER_POOLS',
    });
    expect(resolvers).toHaveLength(8);
  });

  test.each(['createTodo', 'updateTodo', 'deleteTodo', 'getTodo'])(
    '%s deploys the guarded item response', (fieldName) => {
      const resolver = resolvers.find(item => item.Properties.FieldName === fieldName).Properties;
      expect(resolver.ResponseMappingTemplate).toContain('$util.unauthorized()');
      expect(resolver.ResponseMappingTemplate).toContain('$ctx.result.owners.contains($owner)');
    }
  );

  test.each(['onCreateTodo', 'onUpdateTodo', 'onDeleteTodo'])(
    '%s keeps its existing construct path and uses a NONE data source', (fieldName) => {
      expect(construct.graphqlAPI.node.findChild(fieldName).node.path)
        .toBe(`TodoSecurityTest/Api/DataAPI/${fieldName}`);
      const resolver = resolvers.find(item => item.Properties.FieldName === fieldName).Properties;
      const sources = Object.values(template.findResources('AWS::AppSync::DataSource')) as any[];
      expect(sources.find(item => item.Properties.Type === 'NONE').Properties.Name)
        .toBe('TodoSubscriptions');
      expect(resolver.RequestMappingTemplate).not.toContain('"operation"');
      expect(resolver.ResponseMappingTemplate).toContain('setSubscriptionFilter');
    }
  );
});

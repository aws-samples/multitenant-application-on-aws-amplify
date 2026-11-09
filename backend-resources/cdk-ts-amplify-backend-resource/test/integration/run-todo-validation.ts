/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 */

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import {
  AdminCreateUserCommand, AdminDeleteUserCommand, AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient, InitiateAuthCommand, UpdateUserAttributesCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { validationPurpose } from './todo-validation-stack';

const fields = 'id tenantId sub owners content isDone createdAt updatedAt';
const subscriptionFields = ['onCreateTodo', 'onUpdateTodo', 'onDeleteTodo'];
const wait = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));
const fetchRequest = (globalThis as any).fetch as (
  url: string, options: unknown,
) => Promise<{ status: number; json(): Promise<unknown> }>;

interface Actor {
  username: string; owner: string; preferred: string; tenant?: string; sub: string;
  idToken: string; accessToken: string; refreshToken: string;
}

// Native WebSocket is available in Node 22+. Keep JWTs in protocol headers,
// never in the URL, command line, progress output, or saved report.
class Subscriptions {
  private socket: any;
  private connected = false;
  private failed = false;
  private acknowledgments = new Set<string>();
  private rejected = new Set<string>();
  readonly events: { field: string; item: any }[] = [];

  constructor(url: string, private token: string) {
    const WebSocketClient = (globalThis as any).WebSocket;
    if (!WebSocketClient) throw new Error('Live subscriptions require Node 22 or newer.');
    const endpoint = new URL(url);
    const authorization = { host: endpoint.host, Authorization: token };
    endpoint.protocol = 'wss:';
    endpoint.hostname = endpoint.hostname.replace('.appsync-api.', '.appsync-realtime-api.');
    this.socket = new WebSocketClient(endpoint.toString(), [
      'graphql-ws', `header-${Buffer.from(JSON.stringify(authorization)).toString('base64url')}`,
    ]);
    this.socket.addEventListener('open', () => {
      this.socket.send(JSON.stringify({ type: 'connection_init' }));
    });
    this.socket.addEventListener('error', () => { this.failed = true; });
    this.socket.addEventListener('close', () => { this.failed = true; });
    this.socket.addEventListener('message', (event: any) => {
      try {
        const message = JSON.parse(String(event.data));
        if (message.type === 'connection_ack') this.connected = true;
        if (message.type === 'start_ack') this.acknowledgments.add(message.id);
        if (message.type === 'error') {
          if (message.id) this.rejected.add(message.id);
          else this.failed = true;
        }
        if (message.type === 'data') {
          if (message.payload?.errors?.length) this.failed = true;
          for (const [field, item] of Object.entries(message.payload?.data ?? {})) {
            this.events.push({ field, item });
          }
        }
      } catch {
        this.failed = true;
      }
    });
  }

  assertHealthy(): void {
    assert(!this.failed, 'A subscription connection failed.');
  }

  private async until(predicate: () => boolean): Promise<void> {
    const deadline = Date.now() + 30000;
    while (!predicate()) {
      this.assertHealthy();
      assert(Date.now() < deadline, 'Timed out waiting for a subscription response.');
      await wait(100);
    }
  }

  async start(url: string): Promise<void> {
    await this.until(() => this.connected);
    for (const field of subscriptionFields) {
      const id = randomUUID();
      this.socket.send(JSON.stringify({
        id, type: 'start',
        payload: {
          data: JSON.stringify({ query: `subscription { ${field} { ${fields} } }`, variables: {} }),
          extensions: { authorization: { host: new URL(url).host, Authorization: this.token } },
        },
      }));
      await this.until(() => this.acknowledgments.has(id) || this.rejected.has(id));
      assert(!this.rejected.has(id), 'Subscription authorization rejected.');
    }
  }

  has(field: string, item: any): boolean {
    return this.events.some(event => event.field === field &&
      event.item?.id === item.id && event.item?.content === item.content);
  }

  close(): void {
    this.socket.close();
  }
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      profile: { type: 'string' }, region: { type: 'string' },
      account: { type: 'string' }, 'stack-name': { type: 'string' },
      report: { type: 'string' },
    },
  });
  const { profile, region, account, report } = values;
  const stackName = values['stack-name'];
  assert(profile && region && account && stackName && report,
    'Provide --profile, --region, --account, --stack-name and --report.');
  assert(/^todo-auth-validation-[a-z0-9-]+$/.test(stackName),
    'Use a dedicated todo-auth-validation-* stack.');
  const awsJson = (args: string[]) => JSON.parse(execFileSync('aws', [
    ...args, '--profile', profile, '--region', region, '--output', 'json', '--no-cli-pager',
  ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
  const identity = awsJson(['sts', 'get-caller-identity']);
  assert.equal(identity.Account, account, 'AWS account does not match the intended target.');
  const stack = awsJson([
    'cloudformation', 'describe-stacks', '--stack-name', stackName,
  ]).Stacks[0];
  assert.equal(stack.StackStatus, 'CREATE_COMPLETE', 'Require a freshly created validation stack.');
  assert.equal(stack.StackId.split(':')[4], account);
  assert(stack.Tags?.some((tag: any) =>
    tag.Key === 'purpose' && tag.Value === validationPurpose), 'Validation stack tag is missing.');
  const outputs = Object.fromEntries(stack.Outputs.map((item: any) =>
    [item.OutputKey, item.OutputValue]));
  assert.equal(outputs.ValidationPurpose, validationPurpose);
  assert.equal(outputs.AccountId, account);

  const results: { name: string; status: string; durationMs: number; error?: string }[] = [];
  const client = new CognitoIdentityProviderClient({
    region,
    // Reuse the AWS CLI's authenticated profile, including current SSO sessions.
    // Capture credentials only in memory; never emit them or save them in a report.
    credentials: async () => {
      const credentials = JSON.parse(execFileSync('aws', [
        'configure', 'export-credentials', '--profile', profile, '--format', 'process',
      ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
      return {
        accessKeyId: credentials.AccessKeyId,
        secretAccessKey: credentials.SecretAccessKey,
        sessionToken: credentials.SessionToken,
        expiration: new Date(credentials.Expiration),
      };
    },
  });
  const users: string[] = [];
  const connections: Subscriptions[] = [];
  const run = randomUUID();
  let completed = false;
  const check = async (name: string, action: () => Promise<void>) => {
    const start = Date.now();
    try {
      await action();
      results.push({ name, status: 'passed', durationMs: Date.now() - start });
      console.log(`PASS ${name}`);
    } catch (error: any) {
      results.push({
        name, status: 'failed', durationMs: Date.now() - start,
        error: error.name === 'AssertionError' ? error.message : 'Operation failed; no credentials recorded.',
      });
      throw error;
    }
  };
  const graphql = async (actor: Actor | undefined, query: string, variables: any = {}) => {
    const response = await fetchRequest(outputs.GraphqlUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(actor ? { Authorization: actor.idToken } : {}),
      },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(30000),
    });
    return { status: response.status, body: await response.json() as any };
  };
  const operation = async (actor: Actor, field: string, input: any) => {
    const isQuery = field === 'getTodo';
    const usesId = isQuery || field === 'deleteTodo';
    const result = await graphql(actor,
      `${isQuery ? 'query' : 'mutation'}($${usesId ? 'id: ID!' : 'input: TodoInput'}) {
        ${field}(${usesId ? 'id: $id' : 'input: $input'}) { ${fields} }
      }`, usesId ? { id: input } : { input });
    return result.body;
  };
  const allowed = async (actor: Actor, field: string, input: any) => {
    const result = await operation(actor, field, input);
    assert(!result.errors?.length, `${field} unexpectedly failed.`);
    return result.data[field];
  };
  const denied = async (actor: Actor, field: string, input: any) => {
    const result = await operation(actor, field, input);
    assert(result.errors?.some((error: any) =>
      ['Unauthorized', 'UnauthorizedException'].includes(error.errorType)),
    `${field} did not return an authorization denial.`);
    assert(result.data?.[field] == null, `${field} disclosed an item on denial.`);
    assert(!result.errors?.some((error: any) => error.data != null),
      'An authorization error disclosed item data.');
  };
  const actor = async (label: string, owner: string, tenant?: string): Promise<Actor> => {
    const username = `${label}-${run}@example.invalid`;
    const password = `Test4!${randomBytes(24).toString('base64url')}`;
    const attributes = [
      { Name: 'email', Value: `${label}-${run}@example.invalid` },
      { Name: 'email_verified', Value: 'true' },
      { Name: 'preferred_username', Value: owner },
      { Name: 'custom:role', Value: 'User' },
      { Name: 'custom:isAdmin', Value: 'false' },
      ...(tenant ? [{ Name: 'custom:tenantId', Value: tenant }] : []),
    ];
    const created = await client.send(new AdminCreateUserCommand({
      UserPoolId: outputs.UserPoolId, Username: username,
      UserAttributes: attributes, MessageAction: 'SUPPRESS',
    }));
    users.push(username);
    await client.send(new AdminSetUserPasswordCommand({
      UserPoolId: outputs.UserPoolId, Username: username, Password: password, Permanent: true,
    }));
    const authentication = await client.send(new InitiateAuthCommand({
      ClientId: outputs.UserPoolClientId, AuthFlow: 'USER_PASSWORD_AUTH',
      AuthParameters: { USERNAME: username, PASSWORD: password },
    }));
    const sub = created.User?.Attributes?.find(item => item.Name === 'sub')?.Value;
    assert(sub && authentication.AuthenticationResult?.IdToken &&
      authentication.AuthenticationResult.AccessToken &&
      authentication.AuthenticationResult.RefreshToken, 'User authentication was incomplete.');
    return {
      username, owner: username, preferred: owner, tenant, sub,
      idToken: authentication.AuthenticationResult.IdToken,
      accessToken: authentication.AuthenticationResult.AccessToken,
      refreshToken: authentication.AuthenticationResult.RefreshToken,
    };
  };
  const events = async (
    field: string, item: any, expected: Subscriptions[], excluded: Subscriptions[],
  ) => {
    const deadline = Date.now() + 30000;
    while (!expected.every(connection => connection.has(field, item))) {
      connections.forEach(connection => connection.assertHealthy());
      assert(Date.now() < deadline, `Timed out waiting for ${field} delivery.`);
      await wait(100);
    }
    // Negative delivery observations are bounded; positive controls also prove
    // the excluded users' connections work for their own tenant/owner records.
    await wait(3000);
    connections.forEach(connection => connection.assertHealthy());
    assert(excluded.every(connection => !connection.has(field, item)),
      `${field} was delivered outside the permitted tenant/owner set.`);
  };

  try {
    // Verify the gate before putting even synthetic user/data records in the stack.
    await check('anonymous API access is denied before test data is created', async () => {
      const response = await graphql(undefined, 'query { listTodos { id } }');
      assert([401, 403].includes(response.status), 'Anonymous request was not rejected.');
      assert(response.body.errors?.some((error: any) =>
        /Unauthorized/.test(error.errorType ?? '')), 'The rejection was not the API auth gate.');
    });
    const alice = await actor('alice', 'owner-a', 'TenantA');
    const bob = await actor('bob', 'co-owner-a', 'TenantA');
    const carol = await actor('carol', 'other-a', 'TenantA');
    const outsider = await actor('outsider', 'owner-a', 'TenantB');
    const missingTenant = await actor('missing-tenant', 'missing-tenant');
    await check('a mutable display name cannot change the ownership identity', async () => {
      await client.send(new UpdateUserAttributesCommand({
        AccessToken: carol.accessToken,
        UserAttributes: [{ Name: 'preferred_username', Value: alice.preferred }],
      }));
      const refreshed = await client.send(new InitiateAuthCommand({
        ClientId: outputs.UserPoolClientId, AuthFlow: 'REFRESH_TOKEN_AUTH',
        AuthParameters: { REFRESH_TOKEN: carol.refreshToken },
      }));
      assert(refreshed.AuthenticationResult?.IdToken &&
        refreshed.AuthenticationResult.AccessToken, 'Refresh was incomplete.');
      carol.idToken = refreshed.AuthenticationResult.IdToken;
      carol.accessToken = refreshed.AuthenticationResult.AccessToken;
      const claims = JSON.parse(Buffer.from(carol.idToken.split('.')[1], 'base64url').toString());
      assert.equal(claims.preferred_username, alice.preferred);
      assert.equal(claims['cognito:username'], carol.username);
    });
    await check('all three subscriptions register for each authenticated test user', async () => {
      for (const user of [alice, bob, carol, outsider]) {
        const connection = new Subscriptions(outputs.GraphqlUrl, user.idToken);
        connections.push(connection);
        await connection.start(outputs.GraphqlUrl);
      }
    });
    const [aliceEvents, bobEvents, carolEvents, outsiderEvents] = connections;
    await check('subscriptions reject a user without a tenant claim', async () => {
      const connection = new Subscriptions(outputs.GraphqlUrl, missingTenant.idToken);
      try {
        await assert.rejects(() => connection.start(outputs.GraphqlUrl),
          /Subscription authorization rejected/);
      } finally {
        connection.close();
      }
    });
    await check('creation rejects missing tenant and forged identity fields', async () => {
      await denied(missingTenant, 'createTodo', { content: 'Not stored' });
      await denied(alice, 'createTodo', { tenantId: 'TenantB', content: 'Not stored' });
      await denied(alice, 'createTodo', { sub: outsider.sub, content: 'Not stored' });
      await denied(alice, 'createTodo', { owners: [bob.owner], content: 'Not stored' });
    });
    await check('legacy creation hints cannot set the stored ownership identity', async () => {
      const legacy = await allowed(alice, 'createTodo', {
        tenantId: alice.tenant, sub: alice.sub, owners: [alice.preferred],
        content: `${run}:legacy`, createdAt: '1900-01-01',
      });
      assert.deepEqual(legacy.owners, [alice.username]);
      await allowed(alice, 'deleteTodo', legacy.id);
    });

    let todo: any;
    await check('creation stamps trusted identity and delivers only to its owner', async () => {
      todo = await allowed(alice, 'createTodo', {
        content: `${run}:created`, isDone: 'false',
        createdAt: '1900-01-01', updatedAt: '1900-01-01',
      });
      assert.equal(todo.tenantId, 'TenantA');
      assert.equal(todo.sub, alice.sub);
      assert.deepEqual(todo.owners, [alice.owner]);
      assert.notEqual(todo.createdAt, '1900-01-01');
      assert.notEqual(todo.updatedAt, '1900-01-01');
      await events('onCreateTodo', todo, [aliceEvents],
        [bobEvents, carolEvents, outsiderEvents]);
    });
    await check('reads deny another tenant and a same-tenant non-owner', async () => {
      assert.deepEqual(await allowed(alice, 'getTodo', todo.id), todo);
      await denied(outsider, 'getTodo', todo.id);
      await denied(carol, 'getTodo', todo.id);
      await denied(missingTenant, 'getTodo', todo.id);
    });
    await check('updates cannot cross tenants, claim ownership, or create missing records', async () => {
      await denied(outsider, 'updateTodo', { id: todo.id, content: 'Not stored' });
      await denied(carol, 'updateTodo', { id: todo.id, owners: [carol.owner] });
      await denied(alice, 'updateTodo', { id: todo.id, tenantId: 'TenantB' });
      await denied(alice, 'updateTodo', { id: randomUUID(), content: 'Not stored' });
      assert.deepEqual(await allowed(alice, 'getTodo', todo.id), todo);
    });
    await check('deletes deny other tenants and same-tenant non-owners', async () => {
      await denied(outsider, 'deleteTodo', todo.id);
      await denied(carol, 'deleteTodo', todo.id);
      assert.deepEqual(await allowed(alice, 'getTodo', todo.id), todo);
    });
    await check('sharing preserves the frontend payload and delivers to both owners', async () => {
      todo = await allowed(alice, 'updateTodo', {
        ...todo, owners: [alice.owner, bob.owner], content: `${run}:shared`,
      });
      assert.deepEqual(await allowed(bob, 'getTodo', todo.id), todo);
      await events('onUpdateTodo', todo, [aliceEvents, bobEvents],
        [carolEvents, outsiderEvents]);
    });
    await check('co-owner updates preserve protected identity and omitted fields', async () => {
      const before = todo;
      todo = await allowed(bob, 'updateTodo', {
        id: todo.id, sub: outsider.sub, createdAt: '1900-01-01',
        content: `${run}:co-owner`, isDone: 'true',
      });
      assert.equal(todo.sub, alice.sub);
      assert.equal(todo.createdAt, before.createdAt);
      assert.equal(todo.tenantId, before.tenantId);
      assert.deepEqual(todo.owners, before.owners);
      await events('onUpdateTodo', todo, [aliceEvents, bobEvents],
        [carolEvents, outsiderEvents]);
    });
    await check('lists show shared records only in the permitted tenant/owner set', async () => {
      const deadline = Date.now() + 30000;
      for (;;) {
        const list = await graphql(bob, `query { listTodos { ${fields} } }`);
        assert(!list.body.errors?.length, 'Authorized list failed.');
        if (list.body.data.listTodos.some((item: any) => item.id === todo.id)) break;
        assert(Date.now() < deadline, 'Shared record did not appear in the index.');
        await wait(500);
      }
      for (const user of [carol, outsider]) {
        const list = await graphql(user, 'query { listTodos { id } }');
        assert(!list.body.errors?.length, 'Authorized list failed.');
        assert(!list.body.data.listTodos.some((item: any) => item.id === todo.id));
      }
    });
    await check('revocation blocks later reads, writes, and subscription delivery', async () => {
      todo = await allowed(alice, 'updateTodo', {
        id: todo.id, owners: [alice.owner], content: `${run}:revoked`,
      });
      await denied(bob, 'getTodo', todo.id);
      await denied(bob, 'updateTodo', { id: todo.id, content: 'Not stored' });
      await denied(bob, 'deleteTodo', todo.id);
      await events('onUpdateTodo', todo, [aliceEvents],
        [bobEvents, carolEvents, outsiderEvents]);
    });
    await check('a co-owner can delete and both owners receive the deletion', async () => {
      todo = await allowed(alice, 'updateTodo', {
        id: todo.id, owners: [alice.owner, bob.owner], content: `${run}:delete`,
      });
      await events('onUpdateTodo', todo, [aliceEvents, bobEvents],
        [carolEvents, outsiderEvents]);
      const deleted = await allowed(bob, 'deleteTodo', todo.id);
      await events('onDeleteTodo', deleted, [aliceEvents, bobEvents],
        [carolEvents, outsiderEvents]);
      assert.equal(await allowed(alice, 'getTodo', todo.id), null);
    });
    await check('excluded subscribers receive positive controls for their own records', async () => {
      for (const [user, connection] of [[carol, carolEvents], [outsider, outsiderEvents]] as const) {
        const item = await allowed(user, 'createTodo', { content: `${run}:control-${user.owner}` });
        const excluded = connections.filter(other => other !== connection);
        await events('onCreateTodo', item, [connection], excluded);
        const updated = await allowed(user, 'updateTodo', {
          id: item.id, content: `${item.content}-updated`,
        });
        await events('onUpdateTodo', updated, [connection], excluded);
        const deleted = await allowed(user, 'deleteTodo', item.id);
        await events('onDeleteTodo', deleted, [connection], excluded);
      }
    });
    await check('denied operations leave no forged or orphan records in DynamoDB', async () => {
      const remaining = awsJson([
        'dynamodb', 'scan', '--table-name', outputs.TodoTableName,
        '--select', 'COUNT', '--consistent-read',
      ]);
      assert.equal(remaining.Count, 0, 'Unexpected records remain after authorized cleanup.');
    });
    completed = true;
  } finally {
    connections.forEach(connection => connection.close());
    let cleanupFailed = false;
    for (const username of users) {
      try {
        await client.send(new AdminDeleteUserCommand({
          UserPoolId: outputs.UserPoolId, Username: username,
        }));
      } catch {
        cleanupFailed = true;
      }
    }
    writeFileSync(report, JSON.stringify({
      status: completed && !cleanupFailed ? 'passed' : 'failed',
      account, region, stackName, run, timestamp: new Date().toISOString(),
      tests: results, usersRemoved: !cleanupFailed,
      note: 'Destroy the dedicated validation stack after collecting this report.',
    }, null, 2) + '\n');
    assert(!cleanupFailed, 'Some synthetic users could not be removed; destroy the validation stack.');
    client.destroy();
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(`Live validation failed: ${error.name ?? 'Error'}. See the private report.`);
    process.exitCode = 1;
  });
}

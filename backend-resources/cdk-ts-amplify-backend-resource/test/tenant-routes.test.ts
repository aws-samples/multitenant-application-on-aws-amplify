/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 */

jest.mock('../lib/lambda-code/admin-rest-api/cognito_resources/cognitoApi', () => ({
  createNewUser: jest.fn(),
  addUserToGroup: jest.fn(),
  removeUserFromGroup: jest.fn(),
  confirmUserSignUp: jest.fn(),
  disableUser: jest.fn(),
  enableUser: jest.fn(),
  getUser: jest.fn(),
  listUsers: jest.fn(),
  listGroups: jest.fn(),
  getGroup: jest.fn(),
  listGroupsForUser: jest.fn(),
  listUsersInGroup: jest.fn(),
  signUserOut: jest.fn(),
}));

import router from '../lib/lambda-code/admin-rest-api/routes/users/users.routes';
import * as cognitoApi from '../lib/lambda-code/admin-rest-api/cognito_resources/cognitoApi';

const mockedCognitoApi = jest.mocked(cognitoApi);

function getRouteHandler(path: string, method: 'get' | 'post') {
  const layer = (router as any).stack.find(
    (candidate: any) => candidate.route?.path === path && candidate.route.methods[method]
  );
  if (!layer) {
    throw new Error(`route ${method.toUpperCase()} ${path} was not found`);
  }
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

function responseMock() {
  const response: any = {};
  response.status = jest.fn(() => response);
  response.json = jest.fn(() => response);
  response.end = jest.fn(() => response);
  return response;
}

beforeEach(() => {
  jest.resetAllMocks();
});

describe('tenant-scoped admin routes', () => {
  test('forces tenant-admin user creation to the authorized tenant and non-admin role', async () => {
    mockedCognitoApi.createNewUser.mockResolvedValue({ message: 'created' });
    const handler = getRouteHandler('/createNewUser', 'post');
    const request: any = {
      adminAuthorization: { isGlobalAdmin: false, tenantId: 'TenantA' },
      body: {
        username: 'new-user',
        email: 'new-user@example.com',
        tenantId: 'TenantB',
        isAdmin: 'true',
      },
    };
    const response = responseMock();
    const next = jest.fn();

    await handler(request, response, next);

    expect(mockedCognitoApi.createNewUser).toHaveBeenCalledWith(
      'new-user',
      'new-user@example.com',
      'TenantA',
      'false'
    );
    expect(response.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });

  test('preserves global-admin tenant and role selection', async () => {
    mockedCognitoApi.createNewUser.mockResolvedValue({ message: 'created' });
    const handler = getRouteHandler('/createNewUser', 'post');
    const request: any = {
      adminAuthorization: { isGlobalAdmin: true },
      body: {
        username: 'tenant-admin',
        email: 'tenant-admin@example.com',
        tenantId: 'TenantB',
        isAdmin: 'true',
      },
    };
    const response = responseMock();
    const next = jest.fn();

    await handler(request, response, next);

    expect(mockedCognitoApi.createNewUser).toHaveBeenCalledWith(
      'tenant-admin',
      'tenant-admin@example.com',
      'TenantB',
      'true'
    );
  });

  test('forces group listing to the authorized tenant and filters mismatched users', async () => {
    mockedCognitoApi.listUsersInGroup.mockResolvedValue({
      Users: [
        {
          Username: 'tenant-a-user',
          Attributes: [{ Name: 'custom:tenantId', Value: 'TenantA' }],
        },
        {
          Username: 'tenant-b-user',
          Attributes: [{ Name: 'custom:tenantId', Value: 'TenantB' }],
        },
      ],
      NextToken: 'next-page',
    } as any);
    const handler = getRouteHandler('/listUsersInGroup', 'get');
    const request: any = {
      adminAuthorization: { isGlobalAdmin: false, tenantId: 'TenantA' },
      query: { groupname: 'TenantB', limit: 25 },
    };
    const response = responseMock();
    const next = jest.fn();

    await handler(request, response, next);

    expect(mockedCognitoApi.listUsersInGroup).toHaveBeenCalledWith('TenantA', 25);
    expect(response.json).toHaveBeenCalledWith({
      Users: [
        {
          Username: 'tenant-a-user',
          Attributes: [{ Name: 'custom:tenantId', Value: 'TenantA' }],
        },
      ],
      NextToken: 'next-page',
    });
  });

  test('returns only the authorized tenant group to tenant administrators', async () => {
    mockedCognitoApi.getGroup.mockResolvedValue({
      Group: { GroupName: 'TenantA' },
    } as any);
    const handler = getRouteHandler('/listGroups', 'get');
    const request: any = {
      adminAuthorization: { isGlobalAdmin: false, tenantId: 'TenantA' },
      query: {},
    };
    const response = responseMock();

    await handler(request, response);

    expect(mockedCognitoApi.getGroup).toHaveBeenCalledWith('TenantA');
    expect(response.json).toHaveBeenCalledWith({
      Groups: [{ GroupName: 'TenantA' }],
    });
  });

  test('rejects direct access to a user in another tenant', async () => {
    mockedCognitoApi.getUser.mockResolvedValue({
      Username: 'tenant-b-user',
      UserAttributes: [{ Name: 'custom:tenantId', Value: 'TenantB' }],
    } as any);
    const handler = getRouteHandler('/getUser', 'get');
    const request: any = {
      adminAuthorization: { isGlobalAdmin: false, tenantId: 'TenantA' },
      query: { username: 'tenant-b-user' },
    };
    const response = responseMock();
    const next = jest.fn();

    await handler(request, response, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403 })
    );
    expect(response.json).not.toHaveBeenCalled();
  });
});

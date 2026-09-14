/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 */

import {
  filterUsersToTenant,
  getAdminAuthorization,
  getUserTenantId,
  resolveAuthorizedTenant,
  resolveNewUserAdminFlag,
} from '../lib/lambda-code/admin-rest-api/middleware/adminAuthorization';
import { createAdminCheck } from '../lib/lambda-code/admin-rest-api/middleware/adminCheck';
import {
  getAuthoritativeAdminClaim,
  withAuthoritativeAdminClaim,
} from '../lib/lambda-code/cognito-triggers/tokengen/adminClaim';
import { lambdaHandler } from '../lib/lambda-code/cognito-triggers/tokengen';

describe('authoritative admin claim', () => {
  test('defaults to false when the user is absent from the admin table', () => {
    expect(getAuthoritativeAdminClaim(undefined)).toBe('false');
  });

  test('defaults to false for a non-admin table record', () => {
    expect(getAuthoritativeAdminClaim({ isAdmin: { S: 'false' } })).toBe('false');
  });

  test('returns true only for an authoritative true table record', () => {
    expect(getAuthoritativeAdminClaim({ isAdmin: { S: 'true' } })).toBe('true');
  });

  test('overrides a self-set true claim to false and preserves other overrides', () => {
    expect(withAuthoritativeAdminClaim({
      claimsToAddOrOverride: {
        'custom:isAdmin': 'true',
        'custom:tenantId': 'TenantA',
      },
    }, undefined)).toEqual({
      claimsToAddOrOverride: {
        'custom:isAdmin': 'false',
        'custom:tenantId': 'TenantA',
      },
    });
  });

  test('sets false for a user without tenant attributes', async () => {
    const event: any = {
      request: {
        userAttributes: {
          sub: 'global-admin-sub',
        },
      },
      response: {},
    };

    const result = await lambdaHandler(event, {} as any);

    expect(result.response.claimsOverrideDetails).toEqual({
      claimsToAddOrOverride: {
        'custom:isAdmin': 'false',
      },
    });
  });
});

describe('admin authorization', () => {
  const globalAdminGroup = 'GlobalAdmins';

  test('authorizes a configured global administrator', () => {
    expect(getAdminAuthorization({
      'cognito:groups': 'TenantA,GlobalAdmins',
    }, globalAdminGroup)).toEqual({
      isGlobalAdmin: true,
      tenantId: undefined,
    });
  });

  test('authorizes array-form group claims from a decoded token', () => {
    expect(getAdminAuthorization({
      'cognito:groups': ['TenantA', 'GlobalAdmins'],
    }, globalAdminGroup)).toEqual({
      isGlobalAdmin: true,
      tenantId: undefined,
    });
  });

  test('authorizes serialized group claims from API Gateway', () => {
    expect(getAdminAuthorization({
      'cognito:groups': '["TenantA","GlobalAdmins"]',
    }, globalAdminGroup)).toEqual({
      isGlobalAdmin: true,
      tenantId: undefined,
    });
  });

  test('authorizes a tenant administrator with an authoritative claim', () => {
    expect(getAdminAuthorization({
      'custom:tenantId': 'TenantA',
      'custom:isAdmin': 'true',
    }, globalAdminGroup)).toEqual({
      isGlobalAdmin: false,
      tenantId: 'TenantA',
    });
  });

  test('denies a normal tenant user and fails closed on missing groups', () => {
    expect(getAdminAuthorization({
      'custom:tenantId': 'TenantA',
      'custom:isAdmin': 'false',
    }, globalAdminGroup)).toBeUndefined();
  });

  test('denies all requests when the global admin group is not configured', () => {
    expect(getAdminAuthorization({
      'custom:tenantId': 'TenantA',
      'custom:isAdmin': 'true',
    }, undefined)).toBeUndefined();
  });
});

describe('admin middleware', () => {
  function responseMock() {
    const response: any = {};
    response.status = jest.fn(() => response);
    response.json = jest.fn(() => response);
    return response;
  }

  test('does not bypass authorization for signUserOut', () => {
    const middleware = createAdminCheck('GlobalAdmins');
    const request: any = {
      path: '/admin/users/signUserOut',
      apiGateway: {
        event: {
          requestContext: {
            authorizer: {
              claims: {
                'custom:tenantId': 'TenantA',
                'custom:isAdmin': 'false',
              },
            },
          },
        },
      },
    };
    const response = responseMock();
    const next = jest.fn();

    middleware(request, response, next);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('attaches tenant scope for an authorized tenant administrator', () => {
    const middleware = createAdminCheck('GlobalAdmins');
    const request: any = {
      apiGateway: {
        event: {
          requestContext: {
            authorizer: {
              claims: {
                'custom:tenantId': 'TenantA',
                'custom:isAdmin': 'true',
              },
            },
          },
        },
      },
    };
    const response = responseMock();
    const next = jest.fn();

    middleware(request, response, next);

    expect(request.adminAuthorization).toEqual({
      isGlobalAdmin: false,
      tenantId: 'TenantA',
    });
    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe('tenant isolation', () => {
  test('forces tenant administrators to their token tenant', () => {
    expect(resolveAuthorizedTenant({
      isGlobalAdmin: false,
      tenantId: 'TenantA',
    }, 'TenantB')).toBe('TenantA');
  });

  test('allows global administrators to select a tenant', () => {
    expect(resolveAuthorizedTenant({
      isGlobalAdmin: true,
    }, 'TenantB')).toBe('TenantB');
  });

  test('prevents tenant administrators from creating another administrator', () => {
    expect(resolveNewUserAdminFlag({
      isGlobalAdmin: false,
      tenantId: 'TenantA',
    }, 'true')).toBe('false');
  });

  test('allows global administrators to create a tenant administrator', () => {
    expect(resolveNewUserAdminFlag({
      isGlobalAdmin: true,
    }, 'true')).toBe('true');
  });

  test('reads the immutable tenant attribute from a Cognito user', () => {
    expect(getUserTenantId({
      UserAttributes: [
        { Name: 'email', Value: 'user@example.com' },
        { Name: 'custom:tenantId', Value: 'TenantA' },
      ],
    })).toBe('TenantA');
  });

  test('filters group results by the immutable tenant attribute', () => {
    expect(filterUsersToTenant([
      {
        Username: 'tenant-a-user',
        Attributes: [{ Name: 'custom:tenantId', Value: 'TenantA' }],
      },
      {
        Username: 'tenant-b-user',
        Attributes: [{ Name: 'custom:tenantId', Value: 'TenantB' }],
      },
      {
        Username: 'missing-tenant',
        Attributes: [],
      },
    ], 'TenantA')).toEqual([
      {
        Username: 'tenant-a-user',
        Attributes: [{ Name: 'custom:tenantId', Value: 'TenantA' }],
      },
    ]);
  });
});

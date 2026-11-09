/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 */

const mockVerify = jest.fn();
jest.mock('../lib/lambda-code/statemachine-functions/extract-cognito-groups/node_modules/aws-jwt-verify',
  () => ({ CognitoJwtVerifier: { create: () => ({ verify: (token: string) => mockVerify(token) }) } }));

import { handler } from '../lib/lambda-code/statemachine-functions/extract-cognito-groups';

describe('checked group claims in the separately packaged Lambda', () => {
  const keys = ['GLOBALADMINGROUP', 'USERPOOLID', 'CLIENTID'] as const;
  const original = keys.map(key => process.env[key]);
  beforeAll(() => {
    process.env.GLOBALADMINGROUP = 'GlobalAdmins';
    process.env.USERPOOLID = 'us-east-1_offline';
    process.env.CLIENTID = 'offline-client';
  });
  afterAll(() => keys.forEach((key, index) => {
    if (original[index] === undefined) delete process.env[key];
    else process.env[key] = original[index];
  }));
  test.each([null, {}, { 'cognito:groups': 'GlobalAdmins' }])(
    'fails closed on unusable claims', async claims => {
      mockVerify.mockResolvedValueOnce(claims);
      const result = await handler({ jwtToken: 'Bearer offline-token' }, {});
      expect(result.statusCode).toBe(401);
    }
  );

  test('retains the authorized administrator result', async () => {
    mockVerify.mockResolvedValueOnce({ 'cognito:groups': ['TenantA', 'GlobalAdmins'] });
    const result = await handler({ jwtToken: 'Bearer offline-token' }, {});
    expect(result.group).toBe('GlobalAdmins');
    expect(mockVerify).toHaveBeenLastCalledWith('offline-token');
  });

  test('denies a token that the actual verification step rejects', async () => {
    mockVerify.mockRejectedValueOnce(new Error('Offline expired-token fixture'));
    const result = await handler({ jwtToken: 'Bearer offline-token' }, {});
    expect(result.statusCode).toBe(401);
  });
});

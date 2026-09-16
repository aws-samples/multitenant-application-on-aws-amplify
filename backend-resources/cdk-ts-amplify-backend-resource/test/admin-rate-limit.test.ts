/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 */

import adminRateLimit from '../lib/lambda-code/admin-rest-api/middleware/adminRateLimit';
import router from '../lib/lambda-code/admin-rest-api/routes/users/users.routes';

const testKey = 'rate-limit-test-user';

function requestMock() {
  return {
    ip: '127.0.0.1',
    apiGateway: {
      event: {
        requestContext: {
          authorizer: { claims: { sub: testKey } },
        },
      },
    },
  } as any;
}

function responseMock() {
  const response: any = {
    headersSent: false,
    writableEnded: false,
    setHeader: jest.fn(),
  };
  response.status = jest.fn(() => response);
  response.send = jest.fn(() => {
    response.writableEnded = true;
    return response;
  });
  return response;
}

afterEach(() => {
  adminRateLimit.resetKey(testKey);
});

test('rate limits every admin route before authorization', () => {
  const routeLayers = (router as any).stack.filter((layer: any) => layer.route);

  expect(routeLayers).toHaveLength(12);
  for (const layer of routeLayers) {
    expect(layer.route.stack[0].handle).toBe(adminRateLimit);
    expect(layer.route.stack[1].handle.name).toBe('adminCheck');
  }
});

test('rejects the sixty-first admin request within one minute', async () => {
  adminRateLimit.resetKey(testKey);

  for (let requestNumber = 1; requestNumber <= 60; requestNumber += 1) {
    const response = responseMock();
    const next = jest.fn();

    await adminRateLimit(requestMock(), response, next);

    expect(next).toHaveBeenCalledWith();
    expect(response.status).not.toHaveBeenCalled();
  }

  const response = responseMock();
  const next = jest.fn();
  await adminRateLimit(requestMock(), response, next);

  expect(next).not.toHaveBeenCalled();
  expect(response.status).toHaveBeenCalledWith(429);
  expect(response.send).toHaveBeenCalledWith({
    message: 'too many admin requests; try again later',
  });
});

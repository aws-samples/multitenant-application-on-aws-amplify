/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 */

import { Request } from 'express';
import rateLimit from 'express-rate-limit';

function adminRequestKey(request: Request): string {
  const apiGateway = (request as Request & { apiGateway?: any }).apiGateway;
  return apiGateway?.event?.requestContext?.authorizer?.claims?.sub
    ?? apiGateway?.event?.requestContext?.identity?.sourceIp
    ?? request.ip
    ?? 'unknown-client';
}

const adminRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: adminRequestKey,
  message: { message: 'too many admin requests; try again later' },
});

export default adminRateLimit;

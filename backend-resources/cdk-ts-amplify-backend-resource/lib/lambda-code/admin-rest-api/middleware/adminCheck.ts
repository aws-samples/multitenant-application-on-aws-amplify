/* eslint-disable */
/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 */


import { NextFunction } from 'express';
import { getAdminAuthorization } from './adminAuthorization';

export function createAdminCheck(globalAdminGroup: string | undefined) {
  return function adminCheck(req: any, res: any, next: NextFunction) {
    const claims = req.apiGateway?.event?.requestContext?.authorizer?.claims;
    const authorization = getAdminAuthorization(claims, globalAdminGroup);

    if (!authorization) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    req.adminAuthorization = authorization;
    return next();
  };
}

const adminCheck = createAdminCheck(process.env.GROUP);
  
export default adminCheck;

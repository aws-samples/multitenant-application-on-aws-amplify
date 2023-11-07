/* eslint-disable */
/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 */


import { NextFunction } from 'express';

const gloabalAdminGroup = process.env.GROUP;

// check if user is a global admin
const adminCheck = function (req: any, res: any, next: NextFunction) {

    if (req.path == '/admin/users/signUserOut') {
      return next();
    }
    
    // ensure global admin is set 
    if (typeof gloabalAdminGroup === 'undefined' || gloabalAdminGroup === 'NONE') {
      res.status(401).json({ error: 'Unauthorized' });
    }
   
      const groups = req.apiGateway.event.requestContext.authorizer.claims['cognito:groups'].split(',');
      console.log("print all users cognito groups: ", groups)
 
      if ((gloabalAdminGroup && groups.indexOf(gloabalAdminGroup) > -1)) {
       return next();

      } else if (req.apiGateway.event.requestContext.authorizer.claims['custom:tenantId'] && req.apiGateway.event.requestContext.authorizer.claims['custom:isAdmin'] === 'true') {
        return next();
      
      } else {

 
      res.status(401).json({ error: 'Unauthorized' }); 

      }

  res.status(401).json({ error: 'Unauthorized' });
  };
  
export default adminCheck;

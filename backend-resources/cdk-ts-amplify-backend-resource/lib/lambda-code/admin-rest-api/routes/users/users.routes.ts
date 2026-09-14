/* eslint-disable */
/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 */


import { Request, Response, Router } from 'express';
import adminCheck from '../../middleware/adminCheck';
import {
  AdminAuthorization,
  filterUsersToTenant,
  getUserTenantId,
  resolveAuthorizedTenant,
  resolveNewUserAdminFlag,
} from '../../middleware/adminAuthorization';
import {
  createNewUser,
  addUserToGroup,
  removeUserFromGroup,
  confirmUserSignUp,
  disableUser,
  enableUser,
  getUser,
  listUsers,
  listGroups,
  getGroup,
  listGroupsForUser,
  listUsersInGroup,
  signUserOut,
} from '../../cognito_resources/cognitoApi';


const router = Router();

interface AuthorizedRequest extends Request {
  adminAuthorization?: AdminAuthorization;
  apiGateway?: any;
}

function getAuthorization(req: AuthorizedRequest): AdminAuthorization {
  if (!req.adminAuthorization) {
    const err: any = new Error('authorization context is required');
    err.statusCode = 401;
    throw err;
  }
  return req.adminAuthorization;
}

function getAuthorizedTenant(
  req: AuthorizedRequest,
  requestedTenant?: string
): string | undefined {
  return resolveAuthorizedTenant(getAuthorization(req), requestedTenant);
}

async function ensureUserInAuthorizedTenant(
  req: AuthorizedRequest,
  username: string
): Promise<void> {
  const authorization = getAuthorization(req);
  if (authorization.isGlobalAdmin) {
    return;
  }

  const user = await getUser(username);
  if (!authorization.tenantId || getUserTenantId(user) !== authorization.tenantId) {
    const err: any = new Error('user is outside the authorized tenant');
    err.statusCode = 403;
    throw err;
  }
}

router.get('/listGroups', adminCheck, async (req: AuthorizedRequest, res: Response) => {

    try {
      let response;
      const authorization = getAuthorization(req);
      if (!authorization.isGlobalAdmin && authorization.tenantId) {
        const group = await getGroup(authorization.tenantId);
        response = { Groups: group.Group ? [group.Group] : [] };
      } else if (req.query.token) {
        response = await listGroups(req.query.limit || 25, req.query.token);
      } else if (req.query.limit) {
        let Limit: any
        response = await listGroups((Limit =  req.query.limit));
      } else {
        response = await listGroups();
      }

      res.status(200).json(response);
    } catch (error) {
      console.error('An error ocurred:', error);
      res.status(500).json(error);
     // next(error);
    }
  });

  router.post('/createNewUser', adminCheck, async (req: AuthorizedRequest, res, next) => {
     const authorization = getAuthorization(req);
     const groupName = getAuthorizedTenant(req, req.body.tenantId);
     const isAdmin = resolveNewUserAdminFlag(authorization, req.body.isAdmin);
     if (!req.body.username || !groupName || !req.body.email) {
       const err: any = new Error('username, groupname, and email are required');
       err.statusCode = 400;
       return next(err);
     }
   
     try {
       const response = await createNewUser(
         req.body.username,
         req.body.email,
         groupName,
         isAdmin
       );
       res.status(200).json(response);
     } catch (err) {
       next(err);
     }
   });
   
   router.post('/addUserToGroup',adminCheck, async (req: AuthorizedRequest, res, next) => {
     const groupName = getAuthorizedTenant(req, req.body.groupname);
     if (!req.body.username || !groupName) {
       const err: any = new Error('username and groupname are required');
       err.statusCode = 400;
       return next(err);
     }
   
     try {
       await ensureUserInAuthorizedTenant(req, req.body.username);
       const response = await addUserToGroup(req.body.username, groupName);
       res.status(200).json(response);
     } catch (err) {
       next(err);
     }
   });
   
   
router.post('/removeUserFromGroup', adminCheck, async (req: AuthorizedRequest, res, next) => {
  const groupName = getAuthorizedTenant(req, req.body.groupname);
  if (!req.body.username || !groupName) {
    const err: any = new Error('username and groupname are required');
    err.statusCode = 400;
    return next(err);
  }

  try {
    await ensureUserInAuthorizedTenant(req, req.body.username);
    const response = await removeUserFromGroup(req.body.username, groupName);
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
});

router.post('/confirmUserSignUp',adminCheck, async (req: AuthorizedRequest, res, next) => {
  if (!req.body.username) {
    const err: any = new Error('username is required');
    err.statusCode = 400;
    return next(err);
  }

  try {
    await ensureUserInAuthorizedTenant(req, req.body.username);
    const response = await confirmUserSignUp(req.body.username);
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
});

router.post('/disableUser',adminCheck, async (req: AuthorizedRequest, res, next) => {
  if (!req.body.username) {
    const err: any = new Error('username is required');
    err.statusCode = 400;
    return next(err);
  }

  try {
    await ensureUserInAuthorizedTenant(req, req.body.username);
    const response = await disableUser(req.body.username);
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
});

router.post('/enableUser',adminCheck, async (req: AuthorizedRequest, res, next) => {
  if (!req.body.username) {
    const err: any = new Error('username is required');
    err.statusCode = 400;
    return next(err);
  }

  try {
    await ensureUserInAuthorizedTenant(req, req.body.username);
    const response = await enableUser(req.body.username);
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
});

router.get('/getUser',adminCheck, async (req: AuthorizedRequest, res: Response, next) => {
  if (!req.query.username) {
    const err: any = new Error('username is required');
    err.statusCode = 400;
    return next(err);
  }

  try {
    const username = req.query.username as string; 
    await ensureUserInAuthorizedTenant(req, username);
    const response = await getUser(username);
  
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
});

router.get('/listUsers', adminCheck, async (req: AuthorizedRequest, res, next) => {
  try {
    let response;
    const authorization = getAuthorization(req);
    if (!authorization.isGlobalAdmin && authorization.tenantId) {
      response = await listUsersInGroup(
        authorization.tenantId,
        req.query.limit || 25,
        req.query.token
      );
      response.Users = filterUsersToTenant(
        response.Users,
        authorization.tenantId
      );
    } else if (req.query.token) {
      response = await listUsers(req.query.limit || 25, req.query.token);
    } else if (req.query.limit) {
      let Limit: any
      response = await listUsers((Limit = req.query.limit));
    } else {
      response = await listUsers();
    }
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
});


router.get('/listGroupsForUser',adminCheck, async (req: AuthorizedRequest, res, next) => {
  if (!req.query.username) {
    const err: any = new Error('username is required');
    err.statusCode = 400;
    return next(err);
  }

  try {
    let response;
    const username = req.query.username as string; 
    await ensureUserInAuthorizedTenant(req, username);
    if (req.query.token) {
      response = await listGroupsForUser(username, req.query.limit || 25, req.query.token);
    } else if (req.query.limit) {
      let Limit: any
      response = await listGroupsForUser(username, (Limit = req.query.limit));
    } else {
      response = await listGroupsForUser(username);
    }
    const authorization = getAuthorization(req);
    if (!authorization.isGlobalAdmin && authorization.tenantId && response.Groups) {
      response.Groups = response.Groups.filter(
        (group: any) => group.GroupName === authorization.tenantId
      );
    }
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
});

router.get('/listUsersInGroup',adminCheck, async (req: AuthorizedRequest, res, next) => {
  const groupname = getAuthorizedTenant(req, req.query.groupname as string | undefined);
  if (!groupname) {
    const err: any = new Error('groupname is required');
    err.statusCode = 400;
    return next(err);
  }

  try {
    let response;
    const authorization = getAuthorization(req);
    if (req.query.token) {
      response = await listUsersInGroup(groupname, req.query.limit || 25, req.query.token);
    } else if (req.query.limit) {
      response = await listUsersInGroup(groupname, req.query.limit);
    } else {
      response = await listUsersInGroup(groupname);
    }
    if (!authorization.isGlobalAdmin && authorization.tenantId) {
      response.Users = filterUsersToTenant(
        response.Users,
        authorization.tenantId
      );
    }
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
});

router.post('/signUserOut',adminCheck, async (req: AuthorizedRequest, res, next) => {

  if (
    req.body.username != req.apiGateway.event.requestContext.authorizer.claims.username &&
    req.body.username != /[^/]*$/.exec(req.apiGateway.event.requestContext.identity.userArn)![0]
  ) {
    const err: any = new Error('only the user can sign themselves out');
    err.statusCode = 400;
    return next(err);
  }

  try {
    await ensureUserInAuthorizedTenant(req, req.body.username);
    const response = await signUserOut(req.body.username);
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
});


router.use((err: any, req: any, res: any, next: any) => {
  console.error(err.message);
  if (!err.statusCode) err.statusCode = 500; // If err has no specified error code, set error code to 'Internal Server Error (500)'
  res.status(err.statusCode).json({ message: err.message }).end();
});

  

export default router;

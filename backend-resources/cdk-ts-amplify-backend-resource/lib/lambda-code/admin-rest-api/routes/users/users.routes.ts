/* eslint-disable */
/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 */


import { Request, Response, Router } from 'express';
import adminCheck from '../../middleware/adminCheck';
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
  listGroupsForUser,
  listUsersInGroup,
  signUserOut,
} from '../../cognito_resources/cognitoApi';


const router = Router();

let tenantId: string 


router.get('/listGroups', adminCheck, async (req: Request, res: Response) => {

    try {
      let response;
      if (req.query.token) {
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

  router.post('/createNewUser', adminCheck, async (req, res, next) => {   
     const groupName = tenantId || req.body.tenantId
     if (!req.body.username || !groupName || !req.body.email) {
       const err: any = new Error('username, groupname, and email are required');
       err.statusCode = 400;
       return next(err);
     }
   
     try {
       const response = await createNewUser(req.body.username, req.body.email, groupName, req.body.isAdmin);
       res.status(200).json(response);
     } catch (err) {
       next(err);
     }
   });
   
   router.post('/addUserToGroup',adminCheck, async (req, res, next) => {
     if (!req.body.username || !req.body.groupname) {
       const err: any = new Error('username and groupname are required');
       err.statusCode = 400;
       return next(err);
     }
   
     try {
       const response = await addUserToGroup(req.body.username, req.body.groupname);
       res.status(200).json(response);
     } catch (err) {
       next(err);
     }
   });
   
   
router.post('/removeUserFromGroup', adminCheck, async (req, res, next) => {
  if (!req.body.username || !req.body.groupname) {
    const err: any = new Error('username and groupname are required');
    err.statusCode = 400;
    return next(err);
  }

  try {
    const response = await removeUserFromGroup(req.body.username, req.body.groupname);
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
});

router.post('/confirmUserSignUp',adminCheck, async (req, res, next) => {
  if (!req.body.username) {
    const err: any = new Error('username is required');
    err.statusCode = 400;
    return next(err);
  }

  try {
    const response = await confirmUserSignUp(req.body.username);
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
});

router.post('/disableUser',adminCheck, async (req, res, next) => {
  if (!req.body.username) {
    const err: any = new Error('username is required');
    err.statusCode = 400;
    return next(err);
  }

  try {
    const response = await disableUser(req.body.username);
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
});

router.post('/enableUser',adminCheck, async (req, res, next) => {
  if (!req.body.username) {
    const err: any = new Error('username is required');
    err.statusCode = 400;
    return next(err);
  }

  try {
    const response = await enableUser(req.body.username);
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
});

router.get('/getUser',adminCheck, async (req: Request, res: Response, next) => {
  if (!req.query.username) {
    const err: any = new Error('username is required');
    err.statusCode = 400;
    return next(err);
  }

  try {
    const username = req.query.username as string; 
    const response = await getUser(username);
  
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
});

router.get('/listUsers', adminCheck, async (req, res, next) => {
  try {
    let response;
    if (req.query.token) {
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


router.get('/listGroupsForUser',adminCheck, async (req, res, next) => {
  if (!req.query.username) {
    const err: any = new Error('username is required');
    err.statusCode = 400;
    return next(err);
  }

  try {
    let response;
    const username = req.query.username as string; 
    if (req.query.token) {
      response = await listGroupsForUser(username, req.query.limit || 25, req.query.token);
    } else if (req.query.limit) {
      let Limit: any
      response = await listGroupsForUser(username, (Limit = req.query.limit));
    } else {
      response = await listGroupsForUser(username);
    }
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
});

router.get('/listUsersInGroup',adminCheck, async (req, res, next) => {
  if (!req.query.groupname) {
    const err: any = new Error('groupname is required');
    err.statusCode = 400;
    return next(err);
  }

  try {
    let response;
    const groupname = req.query.groupname as string; 
    if (req.query.token) {
      response = await listUsersInGroup(groupname, req.query.limit || 25, req.query.token);
    } else if (req.query.limit) {
      response = await listUsersInGroup(groupname, req.query.limit);
    } else {
      response = await listUsersInGroup(groupname);
    }
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
});

router.post('/signUserOut',adminCheck, async (req: any, res, next) => {

  if (
    req.body.username != req.apiGateway.event.requestContext.authorizer.claims.username &&
    req.body.username != /[^/]*$/.exec(req.apiGateway.event.requestContext.identity.userArn)![0]
  ) {
    const err: any = new Error('only the user can sign themselves out');
    err.statusCode = 400;
    return next(err);
  }

  try {
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
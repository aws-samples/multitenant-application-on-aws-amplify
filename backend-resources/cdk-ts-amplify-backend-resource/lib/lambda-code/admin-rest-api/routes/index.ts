/* eslint-disable */
/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 */



import { Router } from 'express';
import usersRoutes from './users';

const router: Router = Router();

  
router.use('/admin', usersRoutes);

export default router;

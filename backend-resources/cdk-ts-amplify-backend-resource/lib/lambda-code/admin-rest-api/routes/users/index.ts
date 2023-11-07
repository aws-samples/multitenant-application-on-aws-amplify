/* eslint-disable */
/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 */


import { Router } from 'express';

import usersRoutes from './users.routes';

const router = Router();

router.use('/users', usersRoutes);

export default router;
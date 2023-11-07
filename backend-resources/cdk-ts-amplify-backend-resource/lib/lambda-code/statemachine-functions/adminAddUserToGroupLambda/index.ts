/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 */

import { Handler } from 'aws-lambda';
import { CognitoIdentityServiceProvider } from 'aws-sdk';

export const handler: Handler = async (event: any) => {
  const cognitoIdentityServiceProvider = new CognitoIdentityServiceProvider();

  const params: CognitoIdentityServiceProvider.AdminAddUserToGroupRequest = {
    UserPoolId: event.UserPoolId,
    Username: event.Username,
    GroupName: event.GroupName,
  };

  try {
    await cognitoIdentityServiceProvider.adminAddUserToGroup(params).promise();
    console.log('User added to group successfully.');

    // Return any desired response
    return {
      statusCode: 200,
      body: 'User added to group successfully.',
    };
  } catch (error) {
    console.error('Error adding user to group:', error);
    // Return error response
    return {
      statusCode: 500,
      body: 'Error adding user to group.',
    };
  }
};

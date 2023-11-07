/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 */

import { Handler } from 'aws-lambda';
import { CognitoIdentityServiceProvider } from 'aws-sdk';

interface Event {
  UserPoolId: string;
  Username: string;
  TemporaryPassword: string;
  UserAttributes: CognitoIdentityServiceProvider.AttributeType[];
}

export const handler: Handler<Event> = async (event: any) => {
  const cognitoIdentityServiceProvider = new CognitoIdentityServiceProvider();

  const params: CognitoIdentityServiceProvider.AdminCreateUserRequest = {
    UserPoolId: event.UserPoolId,
    Username: event.Username,
    TemporaryPassword: event.TemporaryPassword,
    UserAttributes: event.UserAttributes,
  };

  try {
    await cognitoIdentityServiceProvider.adminCreateUser(params).promise();
    console.log('Admin user created successfully.');

    // Return any desired response
    return {
      statusCode: 200,
      body: 'Admin user created successfully.',
    };
  } catch (error) {
    console.error('Error creating admin user:', error);
    // Return error response
    return {
      statusCode: 500,
      body: 'Error creating admin user.',
    };
  }
};

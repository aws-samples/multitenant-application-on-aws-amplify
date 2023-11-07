/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 */

import { Handler } from 'aws-lambda';
import { CognitoIdentityProviderClient, AdminCreateUserCommand, AttributeType } from "@aws-sdk/client-cognito-identity-provider"; // ES Modules import

interface Event {
  UserPoolId: string;
  Username: string;
  TemporaryPassword: string;
  UserAttributes: AttributeType[];
}

export const handler: Handler<Event> = async (event: any) => {
  const client = new CognitoIdentityProviderClient();

  const params = {
    UserPoolId: event.UserPoolId,
    Username: event.Username,
    TemporaryPassword: event.TemporaryPassword,
    UserAttributes: event.UserAttributes,
  };

  try {
    const command = new AdminCreateUserCommand(params);
    const response = await client.send(command);
    console.log('Admin user created successfully.');

    // Return any desired response
    return {
      statusCode: 200,
      body: {
        message: 'Admin user created successfully.',
        response: JSON.stringify(response)
      },
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

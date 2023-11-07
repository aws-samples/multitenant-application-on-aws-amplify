/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 */

import { Handler } from 'aws-lambda';
import { CognitoIdentityServiceProvider } from 'aws-sdk';

export const handler: Handler = async (event: any) => {
  const cognitoIdentityServiceProvider = new CognitoIdentityServiceProvider();

  const params: CognitoIdentityServiceProvider.CreateGroupRequest  = {
    UserPoolId: process.env.userPoolId!,
    GroupName: event.groupName,
    Description: event.description,
    Precedence: parseInt(process.env.precedence!),
    RoleArn: process.env.tenantGroupRoleArn
  };

  //console.log(JSON.stringify(params, null, 2));

  try {
    await cognitoIdentityServiceProvider.createGroup(params).promise();
    console.log('Group create successfully.');

    // Return any desired response
    return {
      statusCode: 200,
      body: 'Group created successfully.',
    };
  } catch (error) {
    console.error('Error creating userPool group:', error);
    // Return error response
    return {
      statusCode: 500,
      body: 'Error creating userpool group.',
    };
  }
};

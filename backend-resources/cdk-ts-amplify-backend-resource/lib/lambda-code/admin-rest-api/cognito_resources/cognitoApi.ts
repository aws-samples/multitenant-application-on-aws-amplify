/* eslint-disable */
/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 */


import { CognitoIdentityServiceProvider } from  'aws-sdk';
import { addTenantAdmin} from '../dynamodb_resources/dynamodbApi'

const cognitoIdentityServiceProvider = new CognitoIdentityServiceProvider();

const userPoolId: string = process.env.USERPOOL!;
let sub: string;

interface Attribute {
  Name: string;
  Value: string;
}



async function createNewUser(username: string, email: string, groupname: string, isAdmin: string) {
  const generatePassword = () => {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+";
    let password = "";
    for (let i = 0; i < 12; i++) {
      password += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return password;
  };

  const params: any = {
    UserPoolId: userPoolId,
    Username: email,
    DesiredDeliveryMediums: ['EMAIL'],
    TemporaryPassword: generatePassword(),
    UserAttributes: [
      {
        Name: 'preferred_username',
        Value: username
      },
      {
        Name: 'email',
        Value: email,
      },
      {
        Name: 'custom:tenantId',
        Value: groupname,
      },
    ],
  };
  


  try {
    const result = await cognitoIdentityServiceProvider.adminCreateUser(params).promise();

    if(result && result.User && result.User.Attributes){
      const attributes:Array<Attribute> = result.User.Attributes as Array<Attribute>;
      

      for (const attribute of attributes) {
        if (attribute.Name === "sub") {
          sub = attribute.Value;
          break;
        }
      }
  }

    await addUserToGroup(username, groupname)

    if(isAdmin === 'true'){
      await addTenantAdmin(sub, username, groupname, isAdmin);
    }
    return {
      message: `Success adding ${username} to ${groupname}`,
    };
  } catch (err) {
    console.log(err);
    throw err;
  }
}


async function addUserToGroup(username: string, groupname: string) {
  const params: any = {
    GroupName: groupname,
    UserPoolId: userPoolId,
    Username: username,
  };



  try {
    const result = await cognitoIdentityServiceProvider.adminAddUserToGroup(params).promise();
    return {
      message: `Success adding ${username} to ${groupname}`,
    };
  } catch (err) {
    console.log(err);
    throw err;
  }
}

async function removeUserFromGroup(username: string, groupname: string) {
  const params: any = {
    GroupName: groupname,
    UserPoolId: userPoolId,
    Username: username,
  };

  try {
    const result = await cognitoIdentityServiceProvider.adminRemoveUserFromGroup(params).promise();
    return {
      message: `Removed ${username} from ${groupname}`,
    };
  } catch (err) {
    console.log(err);
    throw err;
  }
}

// Confirms as an admin without using a confirmation code.
async function confirmUserSignUp(username: string) {
  const params: any = {
    UserPoolId: userPoolId,
    Username: username,
  };

  try {
    const result = await cognitoIdentityServiceProvider.adminConfirmSignUp(params).promise();
    return {
      message: `Confirmed ${username} registration`,
    };
  } catch (err) {
    console.log(err);
    throw err;
  }
}

async function disableUser(username: string) {
  const params: any = {
    UserPoolId: userPoolId,
    Username: username,
  };

  try {
    const result = await cognitoIdentityServiceProvider.adminDisableUser(params).promise();
    return {
      message: `Disabled ${username}`,
    };
  } catch (err) {
    console.log(err);
    throw err;
  }
}

async function enableUser(username: string) {
  const params: any = {
    UserPoolId: userPoolId,
    Username: username,
  };

  try {
    const result = await cognitoIdentityServiceProvider.adminEnableUser(params).promise();
    return {
      message: `Enabled ${username}`,
    };
  } catch (err) {
    console.log(err);
    throw err;
  }
}

async function getUser(username: string) {
  const params: any = {
    UserPoolId: userPoolId,
    Username: username,
  };

  try {
    const result = await cognitoIdentityServiceProvider.adminGetUser(params).promise();
    return result;
  } catch (err) {
    console.log(err);
    throw err;
  }
}

async function listUsers(Limit?: any, PaginationToken?: any) {
  const params = {
    UserPoolId: userPoolId,
    ...(Limit && { Limit }),
    ...(PaginationToken && { PaginationToken }),
  };



  try {
    const result: any = await cognitoIdentityServiceProvider.listUsers(params).promise();
    result.NextToken = result.PaginationToken;
    delete result.PaginationToken;

    return result;
  } catch (err) {
    console.log(err);
    throw err;
  }
}

async function listGroups(Limit?: any, PaginationToken?: any) {
  const params: CognitoIdentityServiceProvider.ListGroupsRequest = {
    UserPoolId: userPoolId,
    ...(Limit && { Limit }),
    ...(PaginationToken && { PaginationToken }),
  };
  

  try {
    const result: any = await cognitoIdentityServiceProvider.listGroups(params).promise();

    result.NextToken = result.PaginationToken;
    delete result.PaginationToken;
    return result;
  } catch (err) {
    console.log("list groups error: ", err);
    throw err;
  }
}

async function listGroupsForUser(username: string, Limit?: any, NextToken?: any) {
  const params = {
    UserPoolId: userPoolId,
    Username: username,
    ...(Limit && { Limit }),
    ...(NextToken && { NextToken }),
  };

  try {
    const result: any = await cognitoIdentityServiceProvider.adminListGroupsForUser(params).promise();

    result.Groups.forEach((val: any) => {
      delete val.UserPoolId, delete val.LastModifiedDate, delete val.CreationDate, delete val.Precedence, delete val.RoleArn;
    });

    return result;
  } catch (err) {
    console.log(err);
    throw err;
  }
}

async function listUsersInGroup(groupname?: string, Limit?: any, NextToken?: any) {
  const params = {
    GroupName: groupname,
    UserPoolId: userPoolId,
    ...(Limit && { Limit }),
    ...(NextToken && { NextToken }),
  };

  try {
    const result = await cognitoIdentityServiceProvider.listUsersInGroup(params).promise();
    return result;
  } catch (err) {
    console.log(err);
    throw err;
  }
}

async function signUserOut(username: string) {
  const params: any = {
    UserPoolId: userPoolId,
    Username: username,
  };


  try {
    const result = await cognitoIdentityServiceProvider.adminUserGlobalSignOut(params).promise();
    return {
      message: `Signed out ${username} from all devices`,
    };
  } catch (err) {
    console.log(err);
    throw err;
  }
}


export  {
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
};
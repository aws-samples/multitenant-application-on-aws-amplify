/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 */


export const config ={
    environment: "dev", //Environment name should be between 2 and 10 characters (only lowercase alphabets)
    costcenter: "blog", 
    solutionName: "multi-tenant-amplify", 
}

export const tenantIds = ["TenantA", "TenantB"]

const localDevEnv = 'https://localhost:3000'
const cognitoTesting = 'https://oauth.pstmn.io/v1/callback'
export let urls ={
    callbackUrls: [localDevEnv, cognitoTesting], 
    logoutUrls: [`${localDevEnv}/logout`],  
}

const generatePassword = () => {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+";
    let password = "";
    for (let i = 0; i < 12; i++) {
      password += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return password;
  };

  const testpassword = generatePassword()

export const names = {
    amplifyAppName: `${config.environment}-${config.costcenter}-${config.solutionName}`, 
    codecommitRepoBranchName: "main",
    identityPoolName: `${config.solutionName}-idpool-${config.environment}`,
    userPoolClientName: `${config.solutionName}-webclient-${config.environment}`,
    userPoolName: `${config.solutionName}-pool-${config.environment}`,
    isGlobalAdminRole: `${config.solutionName}-isGlobalAdmin-Role-${config.environment}`, 
    isTenantUserRole: `${config.solutionName}-isTenant-User-Role-${config.environment}`,
    isUnauthenticatedRole: `${config.solutionName}-isUnauthenticated-Role-${config.environment}`,
    isAuthenticatedRole: `${config.solutionName}-isAuthenticated-Role-${config.environment}`,
    dynamodbAdminUserTableName:  `${config.solutionName}-TenantAdminUserTable-${config.environment}`,
    dynamodbTodoTableName:  `${config.solutionName}-TaskDataTable-${config.environment}`,
    cognitoGlobalAdminGroupName: "GlobalAdmins",
    globalAdminDefaultUser: {
        preferredUsername: "globalAdmin",
        tempPassword: "ChangeMe!@12",
        email: "globaladmin@example.com"
    },
    codecommitRepoName: `${config.solutionName}-repo-${config.environment}`,
    cognitoDomainPrefix: `${config.solutionName.toLocaleLowerCase()}-app-${config.environment.toLocaleLowerCase()}`,  //domainPrefix for cognitoDomain can contain only lowercase alphabets, numbers and hyphens
    cognitoCustomAttributeNames: ['role', 'isAdmin','tenantId']
}

/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 */




import * as fs from 'fs';
import * as path from 'path';

//const fs = require('fs');
//const path = require('path');

const filePath = path.join(__dirname, '../backend-resources/cdk-ts-amplify-backend-resource/cdk-outputs.json');

let cdkOutputs: any;

if (fs.existsSync(filePath)) {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  cdkOutputs = JSON.parse(fileContent);
} else {
  console.log(`File '${filePath}' does not exist.`);
  cdkOutputs = undefined;
}

// Interface of all expected resource names
export interface StackOutputs {
  stackRegion?: string;
  graphQLApiId?: string;
  graphQLApiUrl?: string;
  adminApiUrl?: string;
  userPoolId?: string;
  userPoolWebClientId?: string;
  confidentialAppClientId?: string;
  identityPoolId?: string;
  amplifyUrl?: string;
  adminTableName?: string;
  storageBucketName?: string;
  CodeCommitRepoName? : string; 
  amplifyAppId? : string 
  [key: string]: any; // add index signature
}

// Function to retrieve and export data from outputs
function retrieveDataFromOutputs(cdkOutputs: any): StackOutputs {
  const tmp: StackOutputs = {};

  if (cdkOutputs) {
    const stackName = Object.keys(cdkOutputs)[0];
    const stackData = cdkOutputs[stackName];

    tmp.userPoolId = stackData?.userPoolId;
    tmp.stackRegion = stackData?.stackRegion; 
    tmp.graphQLApiId = stackData?.graphQLApiId;
    tmp.graphQLApiUrl = stackData?.graphQLApiUrl;
    tmp.adminApiUrl = stackData?.adminApiUrl?.endsWith('/') ? stackData.adminApiUrl.slice(0, -1) : stackData?.adminApiUrl;
    tmp.userPoolWebClientId= stackData?.userPoolWebClientId;
    tmp.identityPoolId = stackData?.identityPoolId;
    tmp.storageBucketName = stackData?.storageBucketName;
    tmp.amplifyUrl = stackData?.amplifyUrl; 
    tmp.CodeCommitRepoName = stackData?.CodeCommitRepoName; 
    tmp.adminTableName = stackData?.adminTableName;
    tmp.amplifyAppId = stackData?.amplifyAppId; 
  }

  return tmp;
}

const data: StackOutputs = retrieveDataFromOutputs(cdkOutputs || {});

export default data;

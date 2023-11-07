/* eslint-disable */
/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 */

import * as fs from 'fs'
import * as path from 'path';

const filePath = path.join(__dirname, '../../../amplify/backend/amplify-meta.json');

let amplifyOutputs: any;

if (fs.existsSync(filePath)) {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  amplifyOutputs = JSON.parse(fileContent);
} else {
  console.log(`File '${filePath}' does not exist.`);
  amplifyOutputs = undefined;
}

// Interface of all expected resource names
export interface AppOutputs {
  amplifyAppId?: string;
  stackName?: string; 
  backendEnvName?: string; 
  stackRegion?: string; 
  amplifyUrl?: string; 
  [key: string]: any; 
}

// Function to retrieve and export data from outputs
function retrieveDataFromOutputs(amplifyOutputs: any): AppOutputs {
  const tmp: AppOutputs = {};

  if (amplifyOutputs) {
    const providers: any = Object.keys(amplifyOutputs)[0];
    const appData = amplifyOutputs[providers].awscloudformation;
    tmp.stackName = appData?.StackName;
    if (tmp.stackName) {
      const parts = tmp.stackName.split('-');
      const envName = parts[2];
      tmp.backendEnvName = envName;
    }
    tmp.stackRegion = appData?.Region;
    tmp.amplifyAppId = appData?.AmplifyAppId;  
    tmp.amplifyUrl = appData?.amplifyUrl; 
  }

  return tmp;
}

const data: AppOutputs = retrieveDataFromOutputs(amplifyOutputs || {});

export default data;

/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 */


import outputs from './getCdkStackOutputs';
import * as fs from 'fs';


//const outputs = require('./getCdkStackOutputs');
//const fs = require('fs');


console.log('Updating  Environmental Variables');

const cdkOutputData = {
  enabled: true,
  REACT_APP_graphQLApiId: outputs.graphQLApiId, 
  REACT_APP_graphQLApiUrl: outputs.graphQLApiUrl, 
  REACT_APP_adminApiUrl: outputs.adminApiUrl, 
  REACT_APP_userPoolId: outputs.userPoolId,
  REACT_APP_userPoolWebClientId: outputs.userPoolWebClientId,
  REACT_APP_identityPoolId: outputs.identityPoolId,
  REACT_APP_storageBucketName: outputs.storageBucketName,
  REACT_APP_stackRegion: outputs.stackRegion
} as Record<string, any>; 


const filename = '.env';


let envString = '';
Object.keys(cdkOutputData).forEach(function(key) {
  envString += `${key}=${cdkOutputData[key]}\n`;
});

fs.writeFileSync(filename, envString);

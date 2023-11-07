/* eslint-disable */
/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 */

import outputs from './getAmplifyOutputs';
import * as fs from 'fs';


console.log('Updating application data');
// Serialize data to target file: 
const outputData = {
  amplifyAppId: outputs.amplifyAppId, 
  stackName: outputs.stackName, 
  stackRegion: outputs.stackRegion, 
  backendEnvName: outputs.backendEnvName

} as Record<string, any>; 



const filename = './config/generatedConfig.ts';


let envString = '';
Object.keys(outputData).forEach(function(key) {
  envString += `export const ${key}="${outputData[key]}"\n`;
});

fs.writeFileSync(filename, envString);

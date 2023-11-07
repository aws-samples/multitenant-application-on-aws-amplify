/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 */



import cdkOutputs from './getCdkStackOutputs'

console.log(`\x1b[33m Amplify Url: \x1b[0m ${cdkOutputs.amplifyUrl}`)
console.log('')
console.log(`\x1b[33m Git Remote: \x1b[0m git remote add codecommit codecommit::${cdkOutputs.stackRegion}://${cdkOutputs.CodeCommitRepoName}`);
console.log('')

console.log(`\x1b[33m Amplify Console Link: \x1b[0m https://${cdkOutputs.stackRegion}.console.aws.amazon.com/amplify/home?region=${cdkOutputs.stackRegion}#/${cdkOutputs.amplifyAppId}`)
console.log('')

console.log(`\x1b[33m Amazon Cognito Console UserPool Link: \x1b[0m https://${cdkOutputs.stackRegion}.console.aws.amazon.com/cognito/v2/idp/user-pools/${cdkOutputs.userPoolId}/users?region=${cdkOutputs.stackRegion}`)
console.log('')
console.log(`\x1b[33m Amazon Dynamodb Console Tenant Admin User Table Link: \x1b[0m https://${cdkOutputs.stackRegion}.console.aws.amazon.com/dynamodbv2/home?region=${cdkOutputs.stackRegion}#item-explorer?table=${cdkOutputs.adminTableName}&maximize=true`)
console.log('')
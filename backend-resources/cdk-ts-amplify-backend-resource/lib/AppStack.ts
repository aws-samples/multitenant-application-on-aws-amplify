/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 */

import { Stack, StackProps, Tags, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { NagSuppressions } from 'cdk-nag'
import { AmplifyAdminApi } from './apigateway-adminapi-constructs'
import { UserPoolClientConstruct, UserPoolConstruct, IdentityPoolConstruct } from './cognito-constructs'
import { DynamoDBConstruct } from './dynamodb-constructs'
import {StateMachineUpdateGlobalSecondaryIndexesConstruct, StateMachineCreateCognitoUserConstruct, StateMachineUpdateAmplifyAppConstruct, } from './statemachine-constructs';
import {S3StorageConstruct, } from './s3-constructs'
import { AppsyncConstruct} from './appsync-construct-resources'
import { CreateCodeCommitRepo } from './codecommit-constructs'
import { CreateAmplifyServiceRoleConstruct, CreateAmplifyAppConstruct} from './amplify-constructs';


import {names} from '../config'

export interface IStackProps extends StackProps{
  environment: string; 
  costcenter: string; 
  solutionName: string; 
}

export class AmplifyMultiTenantResourceStack extends Stack {
  constructor(scope: Construct, id: string, props: IStackProps) {
    super(scope, id, props);

    //Let the building begin! Create Amplify Hosted Application Environment
    let {appId, defaultDomain} = new CreateAmplifyAppConstruct(this, "createAmplifyApp", {...props})
    //Parameterize domain url 
    defaultDomain  =`https://${names.codecommitRepoBranchName}.${defaultDomain}`

    //Create CodeCommit Repo and Amplify Service Role 
    const {codeCommitRepo} = new CreateCodeCommitRepo(this, "create-codecommit-repo", {appId, ...props})
    const {AmplifyServiceRole} = new CreateAmplifyServiceRoleConstruct(this, "create-amplify-service-role", {appId, codeCommitRepo, ...props})


     //Create Cognito Identity Resources 
     const {userPool} = new UserPoolConstruct(this, 'userpool', {...props, defaultDomain});
     const {userPoolClient} = new UserPoolClientConstruct( this, 'userpoolclient',  {userPool,defaultDomain, ...props} );
     const {identityPool, isTenantUserCognitoGroupRole} = new IdentityPoolConstruct(this, 'identitypool', { userPool,  userPoolClient,...props });

      // Create DynamoDB Admin/User Data Tables and S3 User Data Storage: 
      const {adminTable, dataTable} = new DynamoDBConstruct(this, "adminTable", props)
      const {storageBucket} = new S3StorageConstruct(this, "s3 storage", {appId,  isTenantUserCognitoGroupRole, ...props})
    
    
     //Create APIGateway REST and AppSync GraphQL APIs:  
     const {adminApi} =  new AmplifyAdminApi(this, "admin-api", {userPool,adminTable,dataTable, userPoolClient,storageBucket, isTenantUserCognitoGroupRole, ...props})
     const {graphqlAPI}= new AppsyncConstruct(this, "appsync-backend", {userPool, dataTable,...props})
     
   
     //Create StateMachines to manage the Amplify Environment Build and DynamoDB Global Secondary Indices   
    new StateMachineUpdateAmplifyAppConstruct(this, "update-app-serviceRoleStateMachine", {adminApi, userPool, userPoolClient, identityPool, storageBucket, graphqlAPI, codeCommitRepo, AmplifyServiceRole, appId, ...props} )
    new StateMachineUpdateGlobalSecondaryIndexesConstruct(this, "CreateGSIStateMachine", {dataTable,...props})
    //Optional Global Admin User Setup on new deployments: 
    new StateMachineCreateCognitoUserConstruct(this, "createCognitoUserStateMachine", {userPool, ...props})

    NagSuppressions.addStackSuppressions(this, [
      {
        id: 'AwsSolutions-APIG3',
        reason: 'AWS WAFv2 web ACL not apart of demo but recommended in blog.'
      },
      {
        id: 'AwsSolutions-IAM4',
        reason: 'Write Access to CloudWatch Logs',
        appliesTo: [`Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole`]
      },
      {
        id: 'AwsSolutions-IAM5',
        reason: 'Default policy for managing retention of CloudWatch Logs',
      },
    ], true)

    /* The below Cfn Outputs are required to populate the environment variables for local react app testing  */
    new CfnOutput(this, 'userPoolWebClientId', {   value: userPoolClient.userPoolClientId,    });
    new CfnOutput(this, 'graphQLApiUrl', {  value: graphqlAPI.graphqlUrl   })
    new CfnOutput(this, 'graphQLApiId', {   value: graphqlAPI.apiId    })
    new CfnOutput(this, 'stackRegion', {  value: this.region  })
    new CfnOutput(this, 'adminApiUrl', {  value: adminApi.url,});
    new CfnOutput(this, 'identityPoolId', { value: identityPool.ref,  });
    new CfnOutput(this, 'adminTableName', {   description: 'Admin Table Name',  value: adminTable.tableName,}); 
    new CfnOutput(this, 'userPoolId', {     value: userPool.userPoolId,   });
    new CfnOutput(this, 'storageBucketName', {value: storageBucket.bucketName})
    new CfnOutput(this, 'amplifyUrl', {value: `${defaultDomain}`})
    new CfnOutput(this, "CodeCommitRepoName", {value: codeCommitRepo.repositoryName });   
    new CfnOutput(this, "amplifyAppId", {value: appId });  


    //Cognito Testing and Postman Support: 
    // OAuth 2.0, OpenID Connect, and SAML 2.0 federation endpoints reference: https://docs.aws.amazon.com/cognito/latest/developerguide/federation-endpoints.html
    new CfnOutput(this, 'Domain authorize url', { value: `https://${props.solutionName.toLocaleLowerCase()}-app-${props.environment.toLocaleLowerCase()}.auth.${props.env?.region}.amazoncognito.com/authorize` });
    new CfnOutput(this, 'Domain token url', { value: `https://${props.solutionName.toLocaleLowerCase()}-app-${props.environment.toLocaleLowerCase()}.auth.${props.env?.region}.amazoncognito.com/token` });
    new CfnOutput(this, 'userPoolClientId', {    value: userPoolClient.userPoolClientId,    });

    Tags.of(this).add("environment", props.environment)
    Tags.of(this).add("solution", props.solutionName)
    Tags.of(this).add("costcenter", props.costcenter)

  }
}

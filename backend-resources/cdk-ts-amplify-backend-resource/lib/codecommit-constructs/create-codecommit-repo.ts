/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 */

import { Stack, StackProps, Tags} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as codecommit from 'aws-cdk-lib/aws-codecommit';
import {names} from '../../config'


interface IConstructProps extends StackProps {
  appId: string; 
  environment: string; 
  solutionName: string; 
  costcenter: string; 
};

export class CreateCodeCommitRepo extends Construct {

  public readonly codeCommitRepo: codecommit.Repository; 

  constructor(scope: Construct, id: string, props: IConstructProps) {
    super(scope, id);


  // Creates a CodeCommit repository
  const codeCommitRepo = new codecommit.Repository(this, 'create-code-commit-repo', {
    repositoryName: names.codecommitRepoName,
    description: `repo created for ${names.codecommitRepoName}`
  })

  //Grant Amplify App Access to Pull Latest Commit 
  const { region, account }  = Stack.of(this)
  const amplifyAppArn = `arn:aws:amplify:${region}:${account}:apps/${props.appId}`
  codeCommitRepo.grantPull(new iam.ArnPrincipal(amplifyAppArn))

 
  this.codeCommitRepo = codeCommitRepo; 
  
  Tags.of(this).add("environment", props.environment)
  Tags.of(this).add("solution", props.solutionName)
  Tags.of(this).add("costcenter", props.costcenter)

           
  }
}
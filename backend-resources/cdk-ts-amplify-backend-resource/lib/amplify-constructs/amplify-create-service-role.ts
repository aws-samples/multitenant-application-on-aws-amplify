/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 */

import {  Stack, StackProps, Tags} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as codecommit from 'aws-cdk-lib/aws-codecommit';
import { Effect, ManagedPolicy, PolicyDocument, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { NagSuppressions } from 'cdk-nag'


interface IConstructProps extends StackProps {
  appId: string; 
  codeCommitRepo: codecommit.Repository; 
  environment: string; 
  solutionName: string; 
  costcenter: string; 
};

export class CreateAmplifyServiceRoleConstruct extends Construct {

    public readonly AmplifyServiceRole: iam.Role

  constructor(scope: Construct, id: string, props: IConstructProps) {
    super(scope, id);


  // Create application service role for project: 
  const AmplifyServiceRole = new Role(this, `amplify-service-role`, {
    roleName: `${props.solutionName}-amplifyService-${props.appId}-${props.environment}`,
    description: "Custom Amplify Service Role with CodeCommit Access",
    assumedBy: new ServicePrincipal('amplify.amazonaws.com'),
    managedPolicies: [
      ManagedPolicy.fromAwsManagedPolicyName("AdministratorAccess-Amplify")
    ],
    inlinePolicies: {
      AmplifyInlinePolicy: new PolicyDocument({
        assignSids:true,
        statements: [
          new PolicyStatement({
            effect: Effect.ALLOW,
            resources: [props.codeCommitRepo.repositoryArn],
            actions: [
              "codecommit:*"
            ],
          }),
          //https://github.com/aws-amplify/amplify-hosting/issues/1197
          //https://docs.aws.amazon.com/amplify/latest/userguide/security_iam_permissions-reference.html
          new PolicyStatement({
            effect: Effect.ALLOW,
            resources: [
              `arn:aws:amplify:${Stack.of(this).region}:${Stack.of(this).account}:apps/${props.appId}/*`,
              `arn:aws:amplifybackend:${Stack.of(this).region}:${Stack.of(this).account}:backend/${props.appId}/*`,
              `arn:aws:amplify:${Stack.of(this).region}:${Stack.of(this).account}:apps/${props.appId}`,
              `arn:aws:amplifybackend:${Stack.of(this).region}:${Stack.of(this).account}:backend/${props.appId}`,
              `arn:aws:amplify:${Stack.of(this).region}:${Stack.of(this).account}:apps/${props.appId}/backendenvironments/`,
            ],
            actions: [
              "amplify:CreateApp",
              "amplify:CreateBackendEnvironment",
              "amplify:GetApp",
              "amplify:CreateDeployment",
              "amplify:CreateDomainAssociation",
              "amplify:CreateWebHook",
              "amplify:GetBackendEnvironment",
              "amplify:ListApps",
              "amplify:ListBackendEnvironments",
              "amplify:CreateBranch",
              "amplify:GetBranch",
              "amplify:GenerateAccessLogs",
              "amplify:GetArtifactUrl",
              "amplify:GetBackendEnvironment",
              "amplify:GetDomainAssociation",
              "amplify:GetJob",
              "amplify:GetWebHook",
              "amplify:UpdateApp",
              "amplify:ListArtifacts",
              "amplify:ListBranches",
              "amplify:ListDomainAssociations",
              "amplify:ListJobs",
              "amplify:ListTagsForResource",
              "amplify:ListWebHooks",
              "amplify:DeleteBranch",
              "amplify:DeleteApp",
              "amplify:DeleteBackendEnvironment",
              "amplify:DeleteDomainAssociation",
              "amplify:DeleteJob",
              "amplify:DeleteWebHook",
              "amplify:StartDeployment",
              "amplify:StartJob",
              "amplify:StopJob",
              "amplify:TagResource",
              "amplify:UntagResource",
              "amplify:UpdateApp",
              "amplify:UpdateBranch",
              "amplify:UpdateDomainAssociation",
              "amplify:UpdateWebHook",
              "amplifybackend:*"
            ],
          }),
        ],
      }),
    }
  });

    NagSuppressions.addResourceSuppressions(AmplifyServiceRole, [
    {
      id: 'AwsSolutions-IAM4',
      reason: 'Role needs AdministratorAccess-Amplify Permissions'
    },
    {
      id: 'AwsSolutions-IAM5',
      reason: 'Permissions allow creation and deletion of app with specified appId and the sub resources bounded by the specified appId in the region and account of caller'
    },
  ], true)


  this.AmplifyServiceRole = AmplifyServiceRole;  
  
  Tags.of(this).add("environment", props.environment)
  Tags.of(this).add("solution", props.solutionName)
  Tags.of(this).add("costcenter", props.costcenter)

           
  }
}
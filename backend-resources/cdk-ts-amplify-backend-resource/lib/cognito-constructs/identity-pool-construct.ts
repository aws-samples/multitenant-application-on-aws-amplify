/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 */

import { StackProps, Tags, Stack, RemovalPolicy } from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import {Construct} from 'constructs';
import * as customResources from 'aws-cdk-lib/custom-resources';
import {names, tenantIds} from '../../config'
import { NagSuppressions } from 'cdk-nag'


  interface IdentityPoolConstructProps extends StackProps {
  userPool: cognito.UserPool;
  userPoolClient: cognito.UserPoolClient;
  environment: string; 
  solutionName: string; 
  costcenter: string; 
};

export class IdentityPoolConstruct extends Construct {
  public readonly identityPool: cognito.CfnIdentityPool;
  public readonly isTenantUserCognitoGroupRole: iam.Role

  constructor(scope: Construct, id: string, props: IdentityPoolConstructProps) {
    super(scope, id);

 
    const {userPool, userPoolClient} = props;
    
    this.identityPool = new cognito.CfnIdentityPool(this, 'IdentityPool', {
     // allowUnauthenticatedIdentities: true,
     allowUnauthenticatedIdentities: false,
      identityPoolName: names.identityPoolName,
      cognitoIdentityProviders: [
        {
          clientId: userPoolClient.userPoolClientId,
          providerName: userPool.userPoolProviderName,
        },
      ],
    });
    this.identityPool.applyRemovalPolicy(RemovalPolicy.DESTROY);

 
    const isGlobalAdminCognitoGroupRole = new iam.Role(this, 'global-admins-group-role', {
      roleName: names.isGlobalAdminRole,
      description: 'Role for Global administrator users',
      assumedBy: new iam.FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          StringEquals: {
            'cognito-identity.amazonaws.com:aud': this.identityPool.ref,
          },
          'ForAnyValue:StringLike': {
            'cognito-identity.amazonaws.com:amr': 'authenticated',
          },
        },
        'sts:AssumeRoleWithWebIdentity',
      ).withSessionTags(),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    const isTenantUserCognitoGroupRole = new iam.Role(this, 'tenant-user-role', {
      roleName: names.isTenantUserRole,
      description: 'Tenant authenticated users',
      assumedBy: new iam.FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          StringEquals: {
            'cognito-identity.amazonaws.com:aud': this.identityPool.ref,
          },
          'ForAnyValue:StringLike': {
            'cognito-identity.amazonaws.com:amr': 'authenticated',
          },
        },
        'sts:AssumeRoleWithWebIdentity',
      ).withSessionTags(),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    NagSuppressions.addResourceSuppressions(
      isTenantUserCognitoGroupRole,
      [
        {
          id: 'AwsSolutions-IAM4',
          reason: 'Needs access to write to CloudWatch Logs',
          appliesTo: [
            'Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
          ],
        },
      ],
      true
    );
  



      const isAuthenticatedCognitoGroupRole = new iam.Role(this, 'general-users-group-role', {
      roleName: names.isAuthenticatedRole,
      description: 'Default role for authenticated users',
      assumedBy: new iam.WebIdentityPrincipal(
        'cognito-identity.amazonaws.com',
        {
          StringEquals: {
            'cognito-identity.amazonaws.com:aud': this.identityPool.ref,
          },
          'ForAnyValue:StringLike': {
            'cognito-identity.amazonaws.com:amr': 'authenticated',
          },
        },
      ).withSessionTags(),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
      });


    this.isTenantUserCognitoGroupRole = isTenantUserCognitoGroupRole; 

    
    NagSuppressions.addResourceSuppressions(
     [ isAuthenticatedCognitoGroupRole,  isTenantUserCognitoGroupRole, isGlobalAdminCognitoGroupRole],
      [
        {
          id: 'AwsSolutions-IAM4',
          reason: 'Needs access to write to CloudWatch Logs',
          appliesTo: [
            'Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
          ],
        },
      ],
      true
    );
  
     // Default Cognito Identity Pools: 

       // Loop through tenantIds and create a CfnUserPoolGroup for each tenantId
       tenantIds.forEach((tenantId, index) => {
        new cognito.CfnUserPoolGroup(this, tenantId, {
          groupName: tenantId, 
          userPoolId: userPool.userPoolId,
          description: `User pool group for ${tenantId}`,
          precedence: 10, // the role of the group with the lowest precedence - 0 takes effect and is returned by cognito:preferred_role
          roleArn: isTenantUserCognitoGroupRole.roleArn,
        });
      });

      new cognito.CfnUserPoolGroup(this, 'global-admins-group', {
        groupName: names.cognitoGlobalAdminGroupName, 
        userPoolId: userPool.userPoolId,
        description: 'The group for admin users with special privileges',
        precedence: 1, // the role of the group with the lowest precedence - 0 takes effect and is returned by cognito:preferred_role
        roleArn: isGlobalAdminCognitoGroupRole.roleArn,
      });

    new cognito.CfnIdentityPoolRoleAttachment(this,'identity-pool-role-attachment',
      {
        identityPoolId: this.identityPool.ref,
        roles: {
          authenticated: isAuthenticatedCognitoGroupRole.roleArn,
        //  unauthenticated: isAnonymousCognitoGroupRole.roleArn,

        },
        roleMappings: {
          mapping: {
            type: 'Token',
            ambiguousRoleResolution: 'AuthenticatedRole',
            identityProvider: `cognito-idp.${Stack.of(this).region}.amazonaws.com/${userPool.userPoolId}:${userPoolClient.userPoolClientId}`,
            
          },

        },

      },
    );

    const createParameters = {
      "IdentityPoolId": this.identityPool.ref,
      "IdentityProviderName": userPool.userPoolProviderName,
      "PrincipalTags": {
        "isAdmin": 'custom:isAdmin',
        "tenantId": 'custom:tenantId',
      },
      "UseDefaults": false
    }

    const setPrincipalTagAction = {
      action: "setPrincipalTagAttributeMap",
      service: "CognitoIdentity",
      parameters: createParameters,
      physicalResourceId: customResources.PhysicalResourceId.of(this.identityPool.ref)
    }
    const { region, account }  = Stack.of(this)
    const identityPoolArn = `arn:aws:cognito-identity:${region}:${account}:identitypool/${this.identityPool.ref}`

    new customResources.AwsCustomResource(this, 'CustomResourcePrincipalTags', {
      onCreate: setPrincipalTagAction,
      onUpdate: setPrincipalTagAction,
      policy: customResources.AwsCustomResourcePolicy.fromSdkCalls({
        resources: [identityPoolArn],
      }),
    })

    Tags.of(this).add("environment", props.environment)
    Tags.of(this).add("solution", props.solutionName)
    Tags.of(this).add("costcenter", props.costcenter)

  }
}

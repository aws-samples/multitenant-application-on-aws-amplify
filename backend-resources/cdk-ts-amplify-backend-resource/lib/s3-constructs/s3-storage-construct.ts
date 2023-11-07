/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 */

import { Stack, StackProps, Tags, RemovalPolicy } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import {Construct} from 'constructs';
import { Effect } from 'aws-cdk-lib/aws-iam';
import {names} from '../../config'
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { NagSuppressions } from 'cdk-nag'


interface S3StorageConstructProps extends StackProps {
  isTenantUserCognitoGroupRole: iam.Role;
  appId: string; 
  environment: string; 
  solutionName: string; 
  costcenter: string; 
};

export class S3StorageConstruct extends Construct {

  public readonly storageBucket: Bucket; 

  constructor(scope: Construct, id: string, props: S3StorageConstructProps) {
    super(scope, id);

    const { region, account }  = Stack.of(this)

    const bucketName: string = `${props.solutionName.toLocaleLowerCase()}-data-${props.appId}-${props.environment.toLocaleLowerCase()}`
    
      const storageBucket = new s3.Bucket(this, "UserFileStoreBucket", {
       bucketName: bucketName, 
       enforceSSL: true, 
        cors: [
          {
            allowedHeaders: ['*'],
            allowedMethods: [
              s3.HttpMethods.GET,
              s3.HttpMethods.POST,
              s3.HttpMethods.PUT,
              s3.HttpMethods.HEAD,
              s3.HttpMethods.DELETE,
              s3.HttpMethods.POST
            ],
            allowedOrigins: ['*'],
            exposedHeaders: [
              "x-amz-server-side-encryption",
              "x-amz-request-id",
              "x-amz-id-2",
              "ETag"
            ],
            maxAge: 3000
          },
        ],
        removalPolicy: RemovalPolicy.DESTROY,
        autoDeleteObjects: true
      });


      //List Buckets: 
      storageBucket.addToResourcePolicy(
        new iam.PolicyStatement({
          effect: Effect.ALLOW,
          actions: [
            "s3:ListBucket",
          ],
          resources: [
            `arn:aws:s3:::${bucketName}`,
            `arn:aws:s3:::${bucketName}/*`
          ],
          principals: [
          //new iam.ArnPrincipal(`arn:aws:iam::${account}:role/${names.isTenantUserRole}`)
          new iam.ArnPrincipal(props.isTenantUserCognitoGroupRole.roleArn)
          ],
          conditions: {
            "StringLike": {
                          "s3:prefix": [
                            "${aws:PrincipalTag/tenantId}/public/",
                            "${aws:PrincipalTag/tenantId}/public/*",
                            "${aws:PrincipalTag/tenantId}/protected/",
                            "${aws:PrincipalTag/tenantId}/protected/*",
                            "${aws:PrincipalTag/tenantId}/private/${cognito-identity.amazonaws.com:sub}/",
                            "${aws:PrincipalTag/tenantId}/private/${cognito-identity.amazonaws.com:sub}/*"
                          ]
                        }
          }
        }),
      )


    //Delete Objects: 
    storageBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          "s3:DeleteObject"
        ],
        resources: [
          `arn:aws:s3:::${bucketName}/\${aws:PrincipalTag/tenantId}/public/*`,
          `arn:aws:s3:::${bucketName}/\${aws:PrincipalTag/tenantId}/protected/\${cognito-identity.amazonaws.com:sub}/*`,
          `arn:aws:s3:::${bucketName}/\${aws:PrincipalTag/tenantId}/private/\${cognito-identity.amazonaws.com:sub}/*`
        ],
        principals: [
       //new iam.ArnPrincipal(`arn:aws:iam::${account}:role/${names.isTenantUserRole}`)
       new iam.ArnPrincipal(props.isTenantUserCognitoGroupRole.roleArn)
        ],
      }),
    )

      // Get/Put Objects and Tags
    storageBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          "s3:GetObject",
          "s3:PutObject",
          "s3:GetObjectTagging",
          "s3:PutObjectTagging"
        ],
        resources: [
          `arn:aws:s3:::${bucketName}/\${aws:PrincipalTag/tenantId}/public/*`,
          `arn:aws:s3:::${bucketName}/\${aws:PrincipalTag/tenantId}/protected/*`,
          `arn:aws:s3:::${bucketName}/\${aws:PrincipalTag/tenantId}/private/\${cognito-identity.amazonaws.com:sub}/*`
        ],
        principals: [
        //new iam.ArnPrincipal(`arn:aws:iam::${account}:role/${names.isTenantUserRole}`)
        new iam.ArnPrincipal(props.isTenantUserCognitoGroupRole.roleArn)
        ],
      }),
    )
      
    this.storageBucket = storageBucket; 
    
    NagSuppressions.addResourceSuppressions(
      [storageBucket ], 
    [
      {
        id: 'AwsSolutions-S1',
        reason: 'Example does not make use of server access logs',
      },
    ],true)

    Tags.of(this).add("environment", props.environment)
    Tags.of(this).add("solution", props.solutionName)
    Tags.of(this).add("costcenter", props.costcenter)

  }
}

/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 */

import { StackProps, Tags, Stack } from 'aws-cdk-lib';
import {Construct} from 'constructs';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { AwsCustomResource, AwsCustomResourcePolicy, PhysicalResourceId, PhysicalResourceIdReference } from 'aws-cdk-lib/custom-resources';
import {names} from '../../config'
import { NagSuppressions } from 'cdk-nag'

interface IConstructProps extends StackProps {
  environment: string; 
  solutionName: string; 
  costcenter: string; 
};

export class CreateAmplifyAppConstruct extends Construct {

  public appId: string 
  public defaultDomain: string 

  constructor(scope: Construct, id: string, props: IConstructProps) {
    super(scope, id);

    const { region, account }  = Stack.of(this)    

    const createAppParameters ={
        name: names.amplifyAppName,
       autoBranchCreationConfig: {
        enableAutoBuild: true,
        environmentVariables:{
          _LIVE_UPDATES : '[{"pkg":"@aws-amplify/cli","type":"npm","version":"latest"}]'
        }, 
      },
      autoBranchCreationPatterns: ['*'],
      enableBranchAutoBuild: true,
      description: 'Amplify Multi-Tenant SaaS Application Demo',
      enableAutoBranchCreation: true,
      enableBasicAuth: false,
      enableBranchAutoDeletion: true,
        customRules: [
            {
              source: `</^[^.]+$|\\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|ttf|map|json)$)([^.]+$)/>`, /* required */
              target: '/', /* required */
              //condition: 'STRING_VALUE',
              status: '200'
            },
          ],
    }


    // Create Amplify Application: 
   const createAppCr =  new AwsCustomResource(this, 'createAmplifyApplication', {
        onCreate: {
          service: 'Amplify',
          action: 'createApp',
          parameters: createAppParameters, 
          physicalResourceId: PhysicalResourceId.fromResponse("app.appId") , 
          outputPaths: ["app.appId","app.defaultDomain"],
      },
      onDelete: {
        service: 'Amplify',
        action: 'deleteApp',
        parameters: {
          appId: new PhysicalResourceIdReference(), 
        },
        outputPaths: ["app.appId","app.defaultDomain"],
      },
        // policy: AwsCustomResourcePolicy.fromSdkCalls({
        // resources: [
        //   `arn:aws:amplify:${region}:${account}:apps/*`,
        //   `arn:aws:codecommit:${region}:${account}:${names.codecommitRepoName}`
        // ],
        // })
        policy: AwsCustomResourcePolicy.fromStatements([
          new PolicyStatement({
            actions: [`amplify:DeleteApp`, `amplify:CreateApp`],
            resources: [
              `arn:aws:amplify:${region}:${account}:apps/`,
              `arn:aws:amplify:${region}:${account}:apps/*`
            ]
          }),
          new PolicyStatement({
            actions: [
              `codecommit:GetRepository`,
              'codecommit:GetRepositoryTriggers',
              'codecommit:PutRepositoryTriggers'
            ],
            resources: [`arn:aws:codecommit:${region}:${account}:${names.codecommitRepoName}`]
          })
      ]),
    });

    const appId = createAppCr.getResponseField("app.appId");
    const defaultDomain = createAppCr.getResponseField("app.defaultDomain");

  //   const deleteAppCr = new AwsCustomResource(this, 'deleteAmplifyApplication', {
  //     onDelete: {
  //       service: 'Amplify',
  //       action: 'deleteApp',
  //       parameters: {
  //         appId: createAppCr.getResponseField("app.appId"),
  //       }, 
  //       physicalResourceId: PhysicalResourceId.fromResponse("app.appId") , 
  //       outputPaths: ["app.appId","app.defaultDomain"],
  //     },
  //       policy: AwsCustomResourcePolicy.fromStatements([
  //       new PolicyStatement({
  //         actions: [`amplify:DeleteApp`],
  //         resources: [
  //           `arn:aws:amplify:${region}:${account}:apps/`,
  //           `arn:aws:amplify:${region}:${account}:apps/*`
  //         ]
  //       }),
  //       new PolicyStatement({
  //         actions: [
  //           `codecommit:GetRepository`,
  //           'codecommit:GetRepositoryTriggers',
  //           'codecommit:PutRepositoryTriggers'
  //         ],
  //         resources: [`arn:aws:codecommit:${region}:${account}:${names.codecommitRepoName}`]
  //       })
  //   ]),
    
  // });



  NagSuppressions.addResourceSuppressions([createAppCr], [
    {
      id: 'AwsSolutions-IAM5',
      reason: 'Permissions allow app with specified appId and sub resources under that appId to be deleted in the region and account of caller',
    }, 
    {
      id: 'AwsSolutions-IAM4',
      reason: 'Auto created lambda needs write access to cloudwatch logs',
      appliesTo: [
        "Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
      ]
    }, 
  ], true)

  this.defaultDomain = defaultDomain.toString(); 
  this.appId = appId.toString(); 

    Tags.of(this).add("environment", props.environment)
    Tags.of(this).add("solution", props.solutionName)
    Tags.of(this).add("costcenter", props.costcenter)

 
  }
}

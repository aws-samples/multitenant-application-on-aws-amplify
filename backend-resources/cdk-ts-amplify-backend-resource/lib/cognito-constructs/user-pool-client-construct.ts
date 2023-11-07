/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 */

import { StackProps, Tags, Duration } from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import {Construct} from 'constructs';
import {urls, names} from '../../config'

interface IStackProps extends StackProps {
  defaultDomain: string; 
  userPool: cognito.UserPool;
  environment: string; 
  solutionName: string; 
  costcenter: string; 
};

export class UserPoolClientConstruct extends Construct {
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props: IStackProps) {
    super(scope, id);

    const clientReadAttributes = new cognito.ClientAttributes()
      .withStandardAttributes({
        givenName: true,
        familyName: true,
        email: true,
        emailVerified: true,
        address: true,
        birthdate: true,
        gender: true,
        locale: true,
        middleName: true,
        fullname: true,
        nickname: true,
        phoneNumber: true,
        phoneNumberVerified: true,
        profilePicture: true,
        preferredUsername: true,
        profilePage: true,
        timezone: true,
        lastUpdateTime: true,
        website: true,
      })
      .withCustomAttributes(...names.cognitoCustomAttributeNames);

    const clientWriteAttributes = new cognito.ClientAttributes()
      .withStandardAttributes({
        givenName: true,
        familyName: true,
        email: true,
        emailVerified: false,
        address: true,
        birthdate: true,
        gender: true,
        locale: true,
        middleName: true,
        fullname: true,
        nickname: true,
        phoneNumber: true,
        profilePicture: true,
        preferredUsername: true,
        profilePage: true,
        timezone: true,
        lastUpdateTime: true,
        website: true,
      })
      .withCustomAttributes(...names.cognitoCustomAttributeNames);


    this.userPoolClient = new cognito.UserPoolClient(this, 'userpool-client', {
      userPoolClientName: names.userPoolClientName, 
      userPool: props.userPool,
      accessTokenValidity: Duration.minutes(120),
      idTokenValidity: Duration.minutes(120),
      refreshTokenValidity: Duration.days(1),

      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: true,
        },
        scopes: [
          cognito.OAuthScope.OPENID, 
          cognito.OAuthScope.EMAIL, 
          cognito.OAuthScope.PROFILE,
          cognito.OAuthScope.COGNITO_ADMIN,
        ],
        callbackUrls: [...urls.callbackUrls, props.defaultDomain.toString()], 
        logoutUrls: [...urls.logoutUrls, `${props.defaultDomain.toString()}/logout`]
      },
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.COGNITO,
      ],
      readAttributes: clientReadAttributes,
      writeAttributes: clientWriteAttributes,
    });

    const domainPrefix = names.cognitoDomainPrefix

      // Set the hosted UI domain name
      const domain = props.userPool.addDomain('UserPoolDomain', {
        cognitoDomain: {
          domainPrefix,
        },
      });

    domain.signInUrl(this.userPoolClient, {
      redirectUri: props.defaultDomain
    })

    Tags.of(this).add("environment", props.environment)
    Tags.of(this).add("solution", props.solutionName)
    Tags.of(this).add("costcenter", props.costcenter)



  }
}

/* eslint-disable */
/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 */



import { Context, PreTokenGenerationHostedAuthTriggerEvent } from 'aws-lambda';
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import {
  AdminRecord,
  withAuthoritativeAdminClaim,
} from './adminClaim';

const AWS_REGION = process.env['AWS_REGION'];
const TABLE_NAME = process.env['TABLE_NAME'];

const config = { region: AWS_REGION };
const ddbClient = new DynamoDBClient(config);

// https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-pre-token-generation.html
export const lambdaHandler = async (
  event: PreTokenGenerationHostedAuthTriggerEvent,
  context: Context
): Promise<PreTokenGenerationHostedAuthTriggerEvent> => {
 // console.log(`Event: ${JSON.stringify(event, null, 2)}`);


  const tenantId = event.request.userAttributes['custom:tenantId'];
  const sub = event.request.userAttributes['sub'];
  let adminRecord: AdminRecord;

  if (tenantId && sub) {
    const ddbResponse = await ddbClient.send(
      new GetItemCommand({
        TableName: TABLE_NAME,
        Key: {
          id: {
            S: `sub#${sub}`,
          },
        },
      })
    );
    adminRecord = ddbResponse.Item as AdminRecord;
  }

  // Apply a deterministic value for every user. A missing tenant, sub, table record,
  // or explicit true value all resolve to false.
  event.response.claimsOverrideDetails = withAuthoritativeAdminClaim(
    event.response.claimsOverrideDetails,
    adminRecord
  );

  return event;
};

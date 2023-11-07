/* eslint-disable */
/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 */



import { Context, PreTokenGenerationHostedAuthTriggerEvent } from 'aws-lambda';
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';

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

 

  if (tenantId) {
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
    if (ddbResponse?.Item?.isAdmin.S === 'true') {


      //Get Admin Value
      const isAdmin = ddbResponse.Item.isAdmin.S as string;
      //console.log("isAdmin value: ", isAdmin)

      // Update Idenity Token: 
      event.response.claimsOverrideDetails = {
        claimsToAddOrOverride: {
          'custom:isAdmin': `${isAdmin}`,
        },
      };  
    }
  }
  return event;
};

/* eslint-disable */
/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 */


import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';

let tableName = process.env.tableName

const addTenantAdmin = async function (sub: string, username: string,  tenantId: string, isAdmin: string) {
    const item = {
      id: { S: `sub#${sub}` },
      tenantId: { S: `tenant#${tenantId}` },
      isAdmin: { S: isAdmin },
      createdAt: { S: (new Date()).toISOString().split('T')[0]}, 
      updatedAt: { S:(new Date()).toISOString().split('T')[0]}, 

    };

    const config = { region: process.env.AWS_REGION }
    const  ddbClient = new DynamoDBClient(config);
  
    const ddbResponse = await ddbClient.send(
      new PutItemCommand({
        TableName: tableName,
        Item: item,
      })
    );

    return ddbResponse
};


export  {  addTenantAdmin };


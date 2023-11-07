/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 */


import { StackProps, Tags, RemovalPolicy,  } from 'aws-cdk-lib';
import {Construct} from 'constructs';
import { AttributeType, BillingMode, Table, TableClass } from 'aws-cdk-lib/aws-dynamodb';
import { names } from '../../config';



export interface IDynamoStackProps extends StackProps{
  environment: string; 
  costcenter: string; 
  solutionName: string;
}

export class DynamoDBConstruct extends Construct {
  public readonly adminTable: Table;
  public readonly dataTable: Table;

  constructor(scope: Construct, id: string, props: IDynamoStackProps) {
    super(scope, id);

    this.adminTable = new Table(this, 'adminTable', {
      tableName: names.dynamodbAdminUserTableName, 
      removalPolicy: RemovalPolicy.DESTROY,
      billingMode: BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      tableClass: TableClass.STANDARD,
      partitionKey: {
        name: 'id',
        type: AttributeType.STRING,
      },
    });
 

    this.dataTable = new Table(this, 'dataTable', {
      tableName: names.dynamodbTodoTableName,
      removalPolicy: RemovalPolicy.DESTROY,
      billingMode: BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      partitionKey: { 
        name: 'id', 
        type: AttributeType.STRING 
      },
    })


    Tags.of(this).add("environment", props.environment)
    Tags.of(this).add("solution", props.solutionName)
    Tags.of(this).add("costcenter", props.costcenter)


  }
}

/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 */

import {
  DynamoDbDataSource, GraphqlApi, MappingTemplate, Resolver,
} from 'aws-cdk-lib/aws-appsync';
import * as path from 'path';

// Both the sample and its isolated validation stack deploy this resolver setup.
export function addTodoResolvers(api: GraphqlApi, dataSource: DynamoDbDataSource): void {
  const mapping = (filename: string) =>
    MappingTemplate.fromFile(path.join(__dirname, 'mapping-templates', filename));
  const response = mapping('todo-item-response.vtl');

  dataSource.createResolver('QueryGetTodo', {
    typeName: 'Query', fieldName: 'getTodo',
    requestMappingTemplate: mapping('todo-get-request.vtl'),
    responseMappingTemplate: response,
  });
  dataSource.createResolver('QueryListTodos', {
    typeName: 'Query', fieldName: 'listTodos',
    requestMappingTemplate: mapping('todo-query-listTodos-resolver.vtl'),
    responseMappingTemplate: MappingTemplate.dynamoDbResultList(),
  });
  for (const [fieldName, filename] of [
    ['createTodo', 'todo-create-request.vtl'],
    ['updateTodo', 'todo-update-request.vtl'],
    ['deleteTodo', 'todo-delete-request.vtl'],
  ]) {
    dataSource.createResolver(fieldName, {
      typeName: 'Mutation', fieldName,
      requestMappingTemplate: mapping(filename),
      responseMappingTemplate: response,
    });
  }
  const subscriptionSource = api.addNoneDataSource('TodoSubscriptions');
  for (const fieldName of ['onCreateTodo', 'onUpdateTodo', 'onDeleteTodo']) {
    // Preserve the original paths so existing resolvers update in place.
    new Resolver(api, fieldName, {
      api, dataSource: subscriptionSource, typeName: 'Subscription', fieldName,
      requestMappingTemplate: mapping('subscription-request-mapping-template.vtl'),
      responseMappingTemplate: mapping('subscription-response-mapping-template.vtl'),
    });
  }
}

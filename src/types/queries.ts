/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 */


/* tslint:disable */
/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const getTodo = /* GraphQL */ `
  query GetTodo($id: ID!) {
    getTodo(id: $id) {
      id
      createdAt
      updatedAt
      tenantId
      content
      isDone
      sub
      owners
      __typename
    }
  }
`;
export const listTodos = /* GraphQL */ `
  query ListTodos {
    listTodos {
      id
      createdAt
      updatedAt
      tenantId
      content
      isDone
      sub
      owners
      __typename
    }
  }
`;

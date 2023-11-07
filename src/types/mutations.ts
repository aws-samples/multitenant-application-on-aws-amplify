/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 */


/* tslint:disable */
/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const createTodo = /* GraphQL */ `
  mutation CreateTodo($input: TodoInput) {
    createTodo(input: $input) {
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
export const updateTodo = /* GraphQL */ `
  mutation UpdateTodo($input: TodoInput) {
    updateTodo(input: $input) {
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
export const deleteTodo = /* GraphQL */ `
  mutation DeleteTodo($id: ID!) {
    deleteTodo(id: $id) {
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

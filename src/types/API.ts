/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 */


/* tslint:disable */
/* eslint-disable */
//  This file was automatically generated and should not be edited.

export type TodoInput = {
  // __typename: String!
  id?: string | null,
  createdAt?: string | null,
  updatedAt?: string | null,
  tenantId?: string | null,
  content?: string | null,
  isDone?: string | null, 
  sub?: string | null,
  owners?: Array< string | null > | null,
};

export type Todo = {
  __typename: "Todo",
  // __typename: String!
  id?: string | null,
  createdAt?: string | null,
  updatedAt?: string | null,
  tenantId?: string | null,
  content?: string | null,
  isDone?: string | null, 
  sub?: string | null,
  owners?: Array< string | null > | null,
};

export type CreateTodoMutationVariables = {
  input?: TodoInput | null,
};

export type CreateTodoMutation = {
  createTodo?:  {
    __typename: "Todo",
    // __typename: String!
    id?: string | null,
    createdAt?: string | null,
    updatedAt?: string | null,
    tenantId?: string | null,
    content?: string | null,
    isDone?: string | null, 
    sub?: string | null,
    owners?: Array< string | null > | null,
  } | null,
};

export type UpdateTodoMutationVariables = {
  input?: TodoInput | null,
};

export type UpdateTodoMutation = {
  // @aws_iam @aws_cognito_user_pools
  updateTodo?:  {
    __typename: "Todo",
    // __typename: String!
    id?: string | null,
    createdAt?: string | null,
    updatedAt?: string | null,
    tenantId?: string | null,
    content?: string | null,
    isDone?: string | null, 
    sub?: string | null,
    owners?: Array< string | null > | null,
  } | null,
};

export type DeleteTodoMutationVariables = {
  id: string,
};

export type DeleteTodoMutation = {
  // @aws_iam @aws_cognito_user_pools
  // deleteTodo(id: ID!): Todo @aws_cognito_user_pools(cognito_groups: ["Admin"])
  deleteTodo?:  {
    __typename: "Todo",
    // __typename: String!
    id?: string | null,
    createdAt?: string | null,
    updatedAt?: string | null,
    tenantId?: string | null,
    content?: string | null,
    isDone?: string | null, 
    sub?: string | null,
    owners?: Array< string | null > | null,
  } | null,
};

export type GetTodoQueryVariables = {
  id: string,
};

export type GetTodoQuery = {
  getTodo?:  {
    __typename: "Todo",
    // __typename: String!
    id?: string | null,
    createdAt?: string | null,
    updatedAt?: string | null,
    tenantId?: string | null,
    content?: string | null,
    isDone?: string | null, 
    sub?: string | null,
    owners?: Array< string | null > | null,
  } | null,
};

export type ListTodosQuery = {
  // @aws_iam @aws_cognito_user_pools
  listTodos?:  Array< {
    __typename: "Todo",
    // __typename: String!
    id?: string | null,
    createdAt?: string | null,
    updatedAt?: string | null,
    tenantId?: string | null,
    content?: string | null,
    isDone?: string | null, 
    sub?: string | null,
    owners?: Array< string | null > | null,
  } | null > | null,
};

export type OnCreateTodoSubscription = {
  // onCreateTodo(tenantId: String!): Todo @aws_subscribe(mutations: ["createTodo"])
  // onCreateTodo: Todo @aws_subscribe(mutations: ["createTodo","updateTodo"])
  // onCreateTodo(id: String): Todo @aws_subscribe(mutations: ["createTodo"])
  onCreateTodo?:  {
    __typename: "Todo",
    // __typename: String!
    id?: string | null,
    createdAt?: string | null,
    updatedAt?: string | null,
    tenantId?: string | null,
    content?: string | null,
    isDone?: string | null, 
    sub?: string | null,
    owners?: Array< string | null > | null,
  } | null,
};

export type OnUpdateTodoSubscription = {
  onUpdateTodo?:  {
    __typename: "Todo",
    // __typename: String!
    id?: string | null,
    createdAt?: string | null,
    updatedAt?: string | null,
    tenantId?: string | null,
    content?: string | null,
    isDone?: string | null, 
    sub?: string | null,
    owners?: Array< string | null > | null,
  } | null,
};

export type OnDeleteTodoSubscription = {
  onDeleteTodo?:  {
    __typename: "Todo",
    // __typename: String!
    id?: string | null,
    createdAt?: string | null,
    updatedAt?: string | null,
    tenantId?: string | null,
    content?: string | null,
    isDone?: string | null, 
    sub?: string | null,
    owners?: Array< string | null > | null,
  } | null,
};

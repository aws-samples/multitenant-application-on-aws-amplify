/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 */

import { readFileSync } from 'fs';
import * as path from 'path';

const velocity = require('amplify-velocity-template');

// Java collection methods and AppSync utilities supplied to the real VTL engine.
// These adapters contain no tenant or ownership authorization decisions.
function javaValue(value: any): any {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  return new Proxy(value, {
    set(target, property, item) {
      // The local engine attaches a rendering helper to method receivers.
      // It is not a data attribute in AppSync's Java maps.
      if (property === 'eval' && typeof item === 'function') {
        Object.defineProperty(target, property, {
          value: item, configurable: true, writable: true, enumerable: false,
        });
        return true;
      }
      return Reflect.set(target, property, item);
    },
    get(target, property) {
      if (property === 'get') return (key: string) => javaValue(target[key]);
      if (property === 'put') return (key: string, item: any) => {
        target[key] = item;
        return null;
      };
      if (property === 'containsKey') return (key: string) =>
        Object.prototype.hasOwnProperty.call(target, key);
      if (property === 'size') return () =>
        Array.isArray(target) ? target.length : Object.keys(target).length;
      if (property === 'isEmpty') return () =>
        Array.isArray(target) ? target.length === 0 : Object.keys(target).length === 0;
      if (Array.isArray(target)) {
        if (property === 'contains') return (item: any) => target.includes(item);
        if (property === 'add') return (item: any) => {
          target.push(item);
          return true;
        };
      }
      const item = Reflect.get(target, property);
      return typeof item === 'function' ? item.bind(target) : javaValue(item);
    },
  });
}

export function dynamoValue(value: any): any {
  if (value == null) return { NULL: true };
  if (typeof value === 'string') return { S: value };
  if (typeof value === 'number') return { N: String(value) };
  if (typeof value === 'boolean') return { BOOL: value };
  if (Array.isArray(value)) return { L: value.map(dynamoValue) };
  return { M: Object.fromEntries(Object.entries(value).map(([key, item]) =>
    [key, dynamoValue(item)])) };
}

export function fromDynamo(value: any): any {
  if ('S' in value) return value.S;
  if ('N' in value) return Number(value.N);
  if ('BOOL' in value) return value.BOOL;
  if ('NULL' in value) return null;
  if ('L' in value) return value.L.map(fromDynamo);
  return Object.fromEntries(Object.entries(value.M).map(([key, item]) =>
    [key, fromDynamo(item)]));
}

export function render(template: string, context: any) {
  const filters: any[] = [];
  const toJson = (value: any) => JSON.stringify(value ?? null);
  const util = {
    defaultIfNull: (value: any, fallback: any) => value ?? fallback,
    defaultIfNullOrEmpty: (value: any, fallback: any) =>
      value == null || value === '' ? fallback : value,
    isNull: (value: any) => value == null,
    isString: (value: any) => typeof value === 'string',
    isNullOrBlank: (value: any) => value == null ||
      (typeof value === 'string' && value.trim() === ''),
    unauthorized: () => { throw new Error('Unauthorized'); },
    error: (message: string, type: string) => {
      throw new Error(`${type}: ${message}`);
    },
    qr: () => '',
    toJson,
    autoId: () => 'server-generated-id',
    dynamodb: {
      toString: (value: string) => ({ S: value }),
      toDynamoDB: dynamoValue,
      toDynamoDBJson: (value: any) => toJson(dynamoValue(value)),
      toMapValuesJson: (value: any) => toJson(Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, dynamoValue(item)])
      )),
    },
    time: {
      nowFormatted: () => '2026-11-07',
      nowEpochMilliSeconds: () => Date.UTC(2026, 10, 7),
      epochMilliSecondsToFormatted: (value: number) =>
        new Date(value).toISOString().split('T')[0],
    },
  };
  const source = readFileSync(path.join(
    __dirname, '../../lib/appsync-construct-resources/mapping-templates', template
  ), 'utf8');
  const output = new velocity.Compile(velocity.parse(source), {
    escape: false,
    valueMapper: javaValue,
  }).render({
    ctx: javaValue(context),
    context: javaValue(context),
    util,
    extensions: {
      setSubscriptionFilter: (filter: any) => {
        filters.push(filter);
        return '';
      },
    },
  });
  return { value: JSON.parse(output), filters };
}

// A small evaluator for DynamoDB's documented predicates. Tests pass the actual
// rendered expression and attribute substitutions, including after a concurrent
// change to the stored record. Unknown predicates fail the test.
export function conditionMatches(condition: any, item: any): boolean {
  return condition.expression.split(' AND ').every((clause: string) => {
    let match = clause.match(/^attribute_(not_)?exists\((#\w+)\)$/);
    if (match) {
      const exists = item != null &&
        item[condition.expressionNames[match[2]]] !== undefined;
      return match[1] ? !exists : exists;
    }
    match = clause.match(/^(#\w+) = (:\w+)$/);
    if (match) {
      return item?.[condition.expressionNames[match[1]]] ===
        fromDynamo(condition.expressionValues[match[2]]);
    }
    match = clause.match(/^contains\((#\w+), (:\w+)\)$/);
    if (match) {
      const collection = item?.[condition.expressionNames[match[1]]];
      return Array.isArray(collection) &&
        collection.includes(fromDynamo(condition.expressionValues[match[2]]));
    }
    throw new Error(`Unsupported test predicate: ${clause}`);
  });
}

export function applyUpdate(update: any, item: any) {
  const result = { ...item };
  for (const assignment of update.expression.replace(/^SET /, '').split(', ')) {
    const [name, value] = assignment.split(' = ');
    result[update.expressionNames[name]] = fromDynamo(update.expressionValues[value]);
  }
  return result;
}

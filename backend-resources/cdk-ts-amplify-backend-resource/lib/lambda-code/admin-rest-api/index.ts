/* eslint-disable */
/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 */



import express, { Express, Request, Response, Router, NextFunction } from 'express';
import awsServerlessExpress from 'aws-serverless-express';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import bodyParser from 'body-parser';
import awsServerlessExpressMiddleware from 'aws-serverless-express/middleware';
import routes from './routes';

const app: Express = express();
app.use(express.json());

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(awsServerlessExpressMiddleware.eventContext());


app.use((req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});


app.use('/', routes);


const server = awsServerlessExpress.createServer(app);


export const handler = ( event: APIGatewayProxyEvent,  context: any): Promise<APIGatewayProxyResult> => {
  return new Promise((resolve, reject) => {
    awsServerlessExpress.proxy(server, event, context, 'PROMISE').promise
      .then((response: APIGatewayProxyResult) => {
        resolve(response);
      })
      .catch((error: any) => {
        reject(error);
      });
  });
};
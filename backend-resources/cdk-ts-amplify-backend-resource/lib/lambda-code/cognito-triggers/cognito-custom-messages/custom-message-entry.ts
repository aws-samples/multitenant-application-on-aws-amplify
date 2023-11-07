/* eslint-disable */
/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 */



/* eslint-disable @typescript-eslint/no-var-requires */
import {Callback, Context} from 'aws-lambda';
import CustomMessage from './custom-message';

if (!process.env.FRONTEND_BASE_URL) {
  throw new Error('Environment variable FRONTEND_BASE_URL is required.');
}

type Event = {
  triggerSource: string;
  request: {
    codeParameter: string;
    userAttributes: {
      preferred_username: string; 
      email: string;
    };
    usernameParameter: string;    
  };
  response: {
    emailSubject: string;
    emailMessage: string;
  };
};

export function main( event: Event,  _context: Context,  callback: Callback): void {

  //console.log("Custom Message Event: ", event)

  const { triggerSource,  request: {codeParameter, userAttributes, usernameParameter} } = event;

  const customMessage = new CustomMessage({   userAttributes,   codeParameter,   usernameParameter  });

  // See Custom message Lambda trigger for syntax: https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-custom-message.html
  switch(triggerSource) {
  
    case 'CustomMessage_AdminCreateUser':
      event.response = customMessage.sendTemporaryPassword();
      break;
  
  
    default:
      event.response = { emailSubject: "Unrecognized", emailMessage: "Unrecognized Request" }
      break;
  }

  callback(null, event);
}

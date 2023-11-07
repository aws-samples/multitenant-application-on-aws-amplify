/* eslint-disable */
/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 */



type CustomMessageProps = {
  codeParameter: string;
  userAttributes: {
    preferred_username?: string; 
    email: string;
  };
  usernameParameter: string;
};



// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface CustomMessage extends CustomMessageProps {}

type CustomMessageReturnValue = {
  emailSubject: string;
  emailMessage: string;
};

class CustomMessage {
  FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL;


  constructor(messageobj: CustomMessageProps) {
    Object.assign(this, messageobj);

  }

  sendTemporaryPassword(): CustomMessageReturnValue {
    return {

      emailSubject: `Access your account for ${this.FRONTEND_BASE_URL} `,

      emailMessage: `Good day!
      <br><br>
      A user account as been created for you to access the following web application: ${this.FRONTEND_BASE_URL} 
      <br><br>
      Please click on the link above to login using the credentials below: <br>
      Your username is <b>${this.userAttributes?.preferred_username}</b> <br> 
      Your temporary password is <b>${this.codeParameter}</b> <br>
      <br>
      <br>
      <br>
      This message is intended for the individual associated with the following email: <b>${this.usernameParameter}</b>. 
      <br>
      <br><br>
      ${new Date().toLocaleString()}
      `,
    };
  }

}

export default CustomMessage;

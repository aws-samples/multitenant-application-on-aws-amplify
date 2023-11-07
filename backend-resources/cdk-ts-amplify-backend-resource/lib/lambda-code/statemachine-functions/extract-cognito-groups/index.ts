/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 */


/* eslint-disable */


import jwt from 'jsonwebtoken';
import { CognitoJwtVerifier } from "aws-jwt-verify";

// Check the token validity
async function checkTokenValidity(token: any, verifier: any) {

    const payload = await verifier.verify(token.toString());

    if (!payload) {
        return { isValid: false, message: "Token not valid!" };
    }else{
        //Debug logging
       // console.log("Token is valid. Payload:", payload);
    }

    // Decode the JWT token
    const decoded = jwt.decode(token);

    // If all checks passed, return the decoded token
    return { isValid: true, message: 'Token is valid', decoded };
}



export const handler = async (event: any, context: any) => {
 //   console.log("print event object: ", JSON.stringify(event, null, 2));

    try {

        
        const globalAdminGroup = process.env.GLOBALADMINGROUP;
        const userPoolId: string = process.env.USERPOOLID!
        const userPoolClientId: string = process.env.CLIENTID! 

        //Check Envars present: 
        if (typeof globalAdminGroup === 'undefined' || globalAdminGroup === 'NONE') {
            return { statusCode: 401, body: 'GlobalAdminGroup EnvVar missing' };
          }

          if (typeof userPoolId === 'undefined' || userPoolId === 'NONE') {
            return { statusCode: 401, body: 'UserPoolId EnvVar missing' };
          }

          if (typeof userPoolClientId === 'undefined' || userPoolClientId === 'NONE') {
            return { statusCode: 401, body: 'userPoolClientId EnvVar missing' };
          }


        // Assuming that the token is passed in the headers as 'Bearer <token>'
       const token = event.jwtToken.split(' ')[1]; 
        
        const verifier = CognitoJwtVerifier.create({
            userPoolId: userPoolId,
            tokenUse: "id",
            clientId: userPoolClientId,
        });
  

        const { isValid, message, decoded } = await checkTokenValidity(token, verifier);

        if (!isValid) {
            return { statusCode: 401, body: message };
        }

        const groups = decoded['cognito:groups'];

        //    console.log('Groups:', groups); 

            const adminGroup = groups.find((group: string ) => group === globalAdminGroup);

            if (!adminGroup) {
                return { statusCode: 401, body: 'GlobalAdmin group not found' };
            }
    
            // Return the list of groups
            return {
                group: adminGroup,
                data: JSON.stringify({ adminGroup })
            };
    


    } catch (err) {
        console.error(err);
        return {
            statusCode: 500,
            body: 'Failed to process token',
        };
    }
};
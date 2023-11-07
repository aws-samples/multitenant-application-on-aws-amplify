/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 */

import React, {useState,useEffect } from 'react';
import  ConfirmationCodeInput  from './ConformationCodeInput';
import './GeneralLogin.css'



interface Props {
  signIn: (username: string, password: string) => Promise<string | undefined>;
  email?: string 
}


function GeneralLogin({ signIn, email }: Props) {
  const [error, setError] = useState<string>();

   useEffect(() => {
 
   },[email]);
    

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const username = e.currentTarget.username.value.trim();
    const password = e.currentTarget.password.value.trim();

    const error: any | undefined = await signIn(username, password)
     if (error && error.message) {
       setError(error.message)
     } 
              
  }
  

  return (
    <div className="form">
    {email ? ( <ConfirmationCodeInput email={email} /> ) : (

        <div className="form">
        <h3>Login to The App</h3>
       
        <form onSubmit={handleSubmit} >
        {error && <h3>{error}</h3>} 
          <div>
            <label>Username:</label>
            <input type="text" name="username" />
          </div>
          <div>
            <label>Password:</label>
            <input type="password" name="password" />
          </div>
          <div>
            <button type="submit">Sign In</button>
          </div>
        </form>

      </div>
      )}
    </div>

  );
}


export default GeneralLogin;
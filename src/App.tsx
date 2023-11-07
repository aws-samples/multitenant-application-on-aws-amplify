/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 */


import {useEffect, useState } from 'react';
import { AmplifyUser } from '@aws-amplify/ui';
import { Amplify, Auth, Storage  } from 'aws-amplify';
import {  Routes, useNavigate, Navigate, Route, useLocation} from "react-router-dom";
import Home from './components/HomeComponents/Home'
import CreateTenantAdmin from './components/GlobalAdminComponents/CreateTenantAdmin';
import GeneralLogin from './components/AuthComponents/GeneralLogin';
import CreateTenantUser from './components/TenantAdmins/CreateTenantUser';
import ConfirmationCodeInput  from './components/AuthComponents/ConformationCodeInput';
import MediaViewer from './components/MediaComponents/MediaViewer';
import TaskShare from './components/TaskComponents/TaskShare';
import CreateNewTenancy from './components/GlobalAdminComponents/CreateNewTenancy';
import CompleteNewPassword from './components/AuthComponents/CompleteNewPassword';


Amplify.configure({
  aws_project_region: process.env.REACT_APP_stackRegion,
  API: {
    endpoints: [
      {
        name: "AdminQueries",
        endpoint: process.env.REACT_APP_adminApiUrl
      }
    ],
    graphql_headers: async () => ({
      Authorization: (await Auth.currentSession()).getIdToken().getJwtToken(),
    }),
  },
  Storage: {
    AWSS3: {
      bucket: process.env.REACT_APP_storageBucketName,
      region: process.env.REACT_APP_stackRegion, 
    }
  },
  aws_appsync_graphqlEndpoint: process.env.REACT_APP_graphQLApiUrl,
  aws_appsync_region: process.env.REACT_APP_stackRegion,
  aws_appsync_authenticationType: 'AMAZON_COGNITO_USER_POOLS' ,
  Auth: {
    identityPoolId: process.env.REACT_APP_identityPoolId, 
    region: process.env.REACT_APP_stackRegion, 
    userPoolId: process.env.REACT_APP_userPoolId, 
    userPoolWebClientId: process.env.REACT_APP_userPoolWebClientId, 
  }
});


function App() {
  const [user, setUser] =  useState<AmplifyUser | undefined>(undefined);
  const [username, setUsername] =  useState<string | undefined>(undefined);
  const [tenantId, setTenantId] = useState<string>('');
  const [isTenantAdmin, setIsTenantAdmin] = useState(false);
  const [userPoolId, setUserPoolId] = useState<string>('');


  const navigate = useNavigate();


  const configureStorage = ((tenantId: string)=>{
    Storage.configure({
      customPrefix: {
          public: `${tenantId}/public/`,
          protected: `${tenantId}/protected/`,
          private: `${tenantId}/private/`,
      }
   })
  })

  const getUser = (async ()=>{
    try{
    let user = await Auth.currentAuthenticatedUser()

   if(user){
      if(user && user.attributes && user.attributes['custom:tenantId']){
        setTenantId(user.attributes['custom:tenantId'] ?? '');
        configureStorage(user.attributes['custom:tenantId'])
        const idToken = user.getSignInUserSession()?.getIdToken();
        const isTenantAdmin: boolean = idToken?.payload['custom:isAdmin'];
        setIsTenantAdmin(isTenantAdmin);
        
      } 
       setUser(user) 
       const idToken = user.getSignInUserSession()?.getIdToken();
       const isTenantAdmin: boolean = idToken?.payload['custom:isAdmin'];
       setIsTenantAdmin(isTenantAdmin);
       const { userPoolId } = user.pool;
       setUserPoolId(userPoolId);
       navigate("/home");
   
    }
  } catch(error){

    setUser(undefined) 
   console.log(error)

  }
    
  }); 

  useEffect( () => {
 
    // to get the current authenticated user object. 
    //https://docs.amplify.aws/lib/auth/manageusers/q/platform/js/#retrieve-current-authenticated-user
    getUser().catch(()=>{
      console.log("getUser function failed")
    })

   },[]);


   const onSignInSuccess = async (userObj: any) => {
      try {
        await getUser()
        navigate("/");
      } catch (error) {
          console.log('error signing out: ', error);
      }
    };
  
  async function signOut() {
    try {
        await Auth.signOut();
        setUser(undefined)
        navigate("/");
    } catch (error) {
        console.log('error signing out: ', error);
    }
  }

  async function handleSignIn(username: string, password: string):Promise<string | undefined> {
    try {
  
      const user = await Auth.signIn(username, password);
      setUser(user);
      if(user && user.attributes && user.attributes['custom:tenantId']){
        setTenantId(user.attributes['custom:tenantId'] ?? '');
        configureStorage(user.attributes['custom:tenantId'])
        const idToken = user.getSignInUserSession()?.getIdToken();
        const isTenantAdmin: boolean = idToken?.payload['custom:isAdmin'];
        setIsTenantAdmin(isTenantAdmin);
      } 
      if (user && user.challengeParam && user.challengeParam.userAttributes['custom:tenantId']){
        setTenantId(user.challengeParam.userAttributes['custom:tenantId']  ?? '');
        configureStorage(user.challengeParam.userAttributes['custom:tenantId'])
      } 
      
      if (user.challengeName === "NEW_PASSWORD_REQUIRED") {
        navigate("/complete-new-password");
      } else {
        navigate("/home");
      }
    } catch (error: any) {
        if (error.code === 'UserNotConfirmedException') {
          console.log(error)
            setUsername(username)
        } else {
          console.log(error.message )
          return error
        }
    }
  }

  function ConfirmationCodeInputWrapper() {
    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);
    const email = searchParams.get("email") || "";
    const code = searchParams.get("code") || "";
    return <ConfirmationCodeInput email={email} code={code} />;
  }

  function NotFound() {
    return <h1>404 - Not Found</h1>;
  }

  return (

    <div>
      
      <Routes>
  
          <Route  path="/"  element={user ?  <Navigate to="home" /> :  <GeneralLogin signIn={handleSignIn} email={username} /> }   />
          
          <Route  path="complete-new-password"    element={<CompleteNewPassword user={user} setUser={setUser} onSignInSuccess={onSignInSuccess} />}   />

          <Route  path="home"  element={ user ? ( <Home signOut={signOut} user={user} />  ) : ( <Navigate to="/" />  ) } /> 

          <Route path="NewTenantAdmin" element={user ? <CreateTenantAdmin /> : <GeneralLogin signIn={handleSignIn} email={username} /> } /> 

          <Route path="CreateNewTenancy" element={user ? <CreateNewTenancy userPoolId={userPoolId} /> : <GeneralLogin signIn={handleSignIn} email={username} /> } /> 

          <Route path="NewUser" element={user ? <CreateTenantUser tenantId={tenantId} userPoolId={userPoolId} /> :  <GeneralLogin signIn={handleSignIn} email={username}  /> } /> 
             
          <Route  path="tasks"  element={user ? <TaskShare user={user} tenantId={tenantId} />: <GeneralLogin signIn={handleSignIn} email={username} /> }   />

          <Route  path="login"  element={user? <Navigate to="home" /> : <GeneralLogin signIn={handleSignIn} email={username}  />  }   />

          <Route path='media' element={user? <MediaViewer user={user} tenantId={tenantId} isTenantAdmin={isTenantAdmin} />  : <GeneralLogin signIn={handleSignIn} email={username}  />  }   />  

          <Route path="complete-registration" element={<ConfirmationCodeInputWrapper />} />

          <Route index element={<GeneralLogin signIn={handleSignIn} email={username} /> } />

          <Route path="*" element={<NotFound />} />

 
      </Routes>

    </div>

  );
}

export default App;
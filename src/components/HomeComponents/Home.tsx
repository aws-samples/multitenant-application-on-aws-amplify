/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 */
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Auth, API } from 'aws-amplify';
import { Button, WithAuthenticatorProps, Text, Flex } from '@aws-amplify/ui-react';
import './Home.css';

interface UserAttribute {
  Name: string;
  Value: string;
}

interface User {
  Attributes: UserAttribute[];
  Enabled: boolean;
  UserCreateDate: string;
  UserLastModifiedDate: string;
  Username: string;
}

interface ResponseData {
  Users: User[];
  NextToken?: string;
}

function Home({ signOut, user }: WithAuthenticatorProps) {
  const [tenantId, setTenantId] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);
  const [isTenantAdmin, setIsTenantAdmin] = useState(false);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  async function listUsers(limit: number, token?: string): Promise<void> {
    setIsLoading(true);
    try {
      const apiName = 'AdminQueries';
      const path = '/admin/users/listUsersInGroup';
      const myInit = {
        queryStringParameters: {
          groupname: tenantId,
          limit: limit,
          token: token || undefined,
        },
        headers: {
          'Content-Type': 'application/json',
          Authorization: `${(await Auth.currentSession()).getIdToken().getJwtToken()}`,
        },
      };

      const response: ResponseData = await API.get(apiName, path, myInit);
      const { Users, NextToken } = response;

      setUsers(Users);
      setNextToken(NextToken || null);
      setCurrentIndex(0);
      setShowModal(true);
      setIsLoading(false);
    } catch (error) {
      console.error(error);
      setIsLoading(false);
    }
  }

  function handleNextUser(): void {
    if (currentIndex < users.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else if (nextToken) {
      listUsers(1, nextToken);
    } else {
      setShowModal(false);
    }
  }

  const handlePreviousUser = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  function handleCloseModal(): void {
    setShowModal(false);
    setCurrentIndex(0);
    setUsers([]);
  }

  useEffect(() => {
    if (user && user.attributes) {
      if (user && user.attributes && user.attributes['custom:tenantId']) {
        setTenantId(user.attributes['custom:tenantId']);
      }
      if (user.attributes['preferred_username']) {
        setUsername(user.attributes['preferred_username']);
      }
      if (user.attributes['email']) {
        setEmail(user.attributes['email']);
      }
      if (user && user.attributes) {
        const idToken = user.getSignInUserSession()?.getIdToken();
        const globalAdmin: boolean = (idToken?.payload['cognito:groups']).some((group: string) => group === 'GlobalAdmins');
        if (globalAdmin) {
          setIsGlobalAdmin(globalAdmin);
        } else {
          const isTenantAdmin: boolean = idToken?.payload['custom:isAdmin'];
          setIsTenantAdmin(isTenantAdmin);
        }
      }
    } else {
      Auth.currentAuthenticatedUser()
        .then((authUser) => {
          setTenantId(authUser.attributes['custom:tenantId']);
        })
        .catch((error) => {
          console.log(error);
        });
    }
  }, [user]);

  const displayUser = users[currentIndex];

  return (
    <div className="home-container">
      <Flex direction="column" padding={8}>
        <Text>
          Email: <b>{user?.username}</b>{' '}
          <Button variation="link" onClick={signOut}>
            Sign out
          </Button>
        </Text>
      </Flex>

      <h1>Welcome to {isGlobalAdmin ? 'GlobalAdmins' : tenantId}</h1>

      <div className="App">
        {isTenantAdmin && <button onClick={() => listUsers(5)}>List Users</button>}
      </div>

      {showModal && (
        <div className="modal">
          <div className="modal-content">
          <button onClick={handleCloseModal}>Close</button>
            <ul>
              <li key={displayUser.Username}>
                <h2>{displayUser.Attributes.find((attr) => attr.Name === 'preferred_username')?.Value || displayUser.Username}</h2>
                <p><b>Enabled:</b> {displayUser.Enabled.toString()}</p>
                <p><b>Created Date:</b> {displayUser.UserCreateDate}</p>
                <p><b>Last Modified Date:</b> {displayUser.UserLastModifiedDate}</p>
                <ul>
                  {displayUser.Attributes.map((attribute, index) => (
                    <li key={`${displayUser.Username}-${attribute.Name}`}>
                      <b>{attribute.Name}:</b> {attribute.Value}
                    </li>
                  ))}
                </ul>
              </li>
            </ul>

            {isLoading ? (
              <p>Loading...</p>
            ) : (
              <>
                {currentIndex > 0 && (
                  <button onClick={handlePreviousUser}>Previous User</button>
                )}
                {currentIndex < users.length - 1 || nextToken ? (
                  <Button onClick={handleNextUser}>Next User</Button>
                ) : null}
              </>
            )}
          </div>
        </div>
      )}


      <h2>Hello {username}</h2>
      <br />

      <p>Please choose an option below:</p>
      <ul id="link-list">
      {!isGlobalAdmin && (
          <>
            <li>
              <Link to="/tasks">My Task</Link>
            </li>
            <li>
              <Link 
              to="/media"
              state={{ isTenantAdmin: isTenantAdmin }}
              >My Media</Link>
            </li>
          </>
        )}
        {isGlobalAdmin && (
            <>
            <li>
              <Link to="/NewTenantAdmin">Create Tenant Admin User</Link>
            </li>
            <li>
              <Link to="/CreateNewTenancy">Create New Tenant Environment</Link>
            </li>
          </>
        )}
        {isTenantAdmin && (
          <li>
            <Link to="/NewUser">Create New Tenant User</Link>
          </li>
        )}
      </ul>
    </div>
  );
}

export default Home;
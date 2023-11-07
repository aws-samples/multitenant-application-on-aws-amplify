/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 */

import React, { useState, useEffect } from 'react';
import { Button, List, Typography, Spin } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { API, Auth } from 'aws-amplify';
import './GlobalAdminTenantStyles.css';

const { Title } = Typography;


interface Group {
  GroupName: string;
  UserPoolId: string;
  LastModifiedDate: string;
  CreationDate: string;
}

interface ResponseData {
  Groups: Group[];
  NextToken?: string;
}

const TenantList = () => {

    const [data, setData] = useState<ResponseData>({  Groups: [], NextToken: "" });
    const [loading, setLoading] = useState(false);

    // List Cognito Groups: 
    async function listCognitoGroups(limit: any): Promise<void>{
      try {
        let apiName = 'AdminQueries';
        let path = '/admin/users/listGroups';
        let myInit = { 
            queryStringParameters: {
              "limit": limit,
              "token": data.NextToken 
            },
            headers: {
              'Content-Type' : 'application/json',
              Authorization: `${(await Auth.currentSession()).getIdToken().getJwtToken()}`
            }
        }
        const response: any =  await API.get(apiName, path, myInit);
        const filteredGroups = response.Groups.filter((group: any) => group.GroupName !== 'GlobalAdmins' && group.GroupName !== 'Users');
           
        setData(prevData => ({
              Groups: [...filteredGroups],
              NextToken: response.NextToken,
            }));
  
          } catch (error) {
          console.error(error);
          }
        }
    
        useEffect(() => {
          async function fetchData() {
            await listCognitoGroups(10)
          }
          fetchData();
        },[]);

        useEffect(() => {
          if (data.NextToken) {
            listCognitoGroups(10); 
          }
        }, [data.NextToken]);
  
  
    return (
      <div className="center-content" id="tenant-list-border">
        
        <div id="tenant-list"></div>
          <h4>
            Current Tenant List
            <Button
              type="text"
              icon={<ReloadOutlined />}
              style={{ float: "right" }} 
              onClick={() => {
               listCognitoGroups(10) //refresh group list
              }}
            />
          </h4>
          <List id="group-list-container"
            dataSource={data.Groups}
            renderItem={group => (
              <li id="group-item">
                <Title level={5}>{group.GroupName}</Title>
              </li>
            )}
          />
          {loading && <Spin />}
      </div>

      
    );
  };
  
  export default TenantList;
  
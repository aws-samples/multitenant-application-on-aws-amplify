/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 */

import React, { useState, useEffect } from 'react';
import { Form, Input, Button, message, Select } from 'antd';
import { API, Auth } from 'aws-amplify';
import { Link } from "react-router-dom";
import './GlobalAdminTenantStyles.css';


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


const CreateTenantAdmin: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const [data, setData] = useState<ResponseData>({  Groups: [] });

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
        let apiName = 'AdminQueries';
        let path = '/admin/users/createNewUser';
        let myInit = {
            body: {
              "username" : values.username,
              "email": values.email,
              "tenantId": values.tenantId,
              "isAdmin": values.isAdmin
            }, 
            headers: {
              'Content-Type' : 'application/json',
              Authorization: `Bearer ${(await Auth.currentSession()).getIdToken().getJwtToken()}`
            } 
        }
         await API.post(apiName, path, myInit);
      message.success('User created successfully!');
      form.resetFields();
    } catch (error: any) {
      message.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const validateEmail = (rule: any, value: string, error: Function) => {
    const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
    if (!value || emailRegex.test(value)) {
      const firstEmail = form.getFieldValue('email');
      if (value && firstEmail && value !== firstEmail) {
        error('The two email addresses do not match');
      }
        error();
    } else {
        error('Please input a valid email address!');
    }
  };

  // List Cognito Groups: 
  async function listCognitoGroups(limit: any): Promise<void>{
    try {
      let apiName = 'AdminQueries';
      let path = '/admin/users/listGroups';
      let myInit = { 
          queryStringParameters: {
            "limit": limit
          },
          headers: {
            'Content-Type' : 'application/json',
            Authorization: `${(await Auth.currentSession()).getIdToken().getJwtToken()}`
          }
      }
      const response: any =  await API.get(apiName, path, myInit);
      const filteredGroups = response.Groups.filter((group: { GroupName: string; }) =>group.GroupName !== 'GlobalAdmins' && group.GroupName !== 'Users');

        setData(prevData => ({
            Groups: [...prevData.Groups, ...filteredGroups],
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
      

  return (
     <div className="center-content">
    
      <h3>Create Tenant Admin:</h3>
      <Link to="/home">Return Home</Link>
      <Form
        name="create-tenant-admin-form"
        layout="vertical"
        form={form}
        onFinish={onFinish}
      >
        <Form.Item
          label="Username"
          name="username"
          rules={[{ required: true, message: 'Please input a username!' }]}
        >
          <Input />
        </Form.Item>


        <Form.Item
          label="Email"
          name="email"
          className="form-item-email"
          rules={[{ required: true, message: 'Please enter your email' }, { type: 'email', message: 'Please enter a valid email' }]}
        >
          <Input />
        </Form.Item>

        <Form.Item
          label="Confirm Email"
          name="confirmEmail"
          className="form-item-email"
          rules={[{ required: true, message: 'Please confirm your email' }, { type: 'email', message: 'Please enter a valid email' }, { validator: validateEmail }]}
        >
          <Input />
        </Form.Item>


         <Form.Item
          label="isAdmin"
          name="isAdmin"
          initialValue="true"
          hidden
        >
          <Input readOnly />
        </Form.Item> 

        <Form.Item
          label="Tenant"
          name="tenantId"
          rules={[{ required: true, message: 'Please select a tenant' }]}
        >
        <Select style={{width: "125px"}}>
            {data.Groups.map((group) => ( 
              <Select.Option key={group.GroupName} value={group.GroupName}>{group.GroupName}</Select.Option>  
              ))
            }
         
        </Select>
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
          Create Tenant Admin
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
};

export default CreateTenantAdmin;

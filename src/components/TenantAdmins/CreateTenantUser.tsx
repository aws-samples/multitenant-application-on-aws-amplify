/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 */



import React, { useState } from 'react';
import { Form, Input, Button, message } from 'antd';
import { API, Auth } from 'aws-amplify';
import { Link } from "react-router-dom";
import './CreateTenantUser.css';


interface CreateTenantUserProps {
  tenantId: string;
  userPoolId: string;
}

const CreateTenantUser: React.FC<CreateTenantUserProps> = ({ tenantId, userPoolId }) => {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();


  const onFinish = async (values: any) => {
    setLoading(true);
    try {
        let apiName = 'AdminQueries';
        let path = '/admin/users/createNewUser';;
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

  const validateEmail = (rule: any, value: string, callback: Function) => {
    const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
    if (!value || emailRegex.test(value)) {
      const firstEmail = form.getFieldValue('email');
      if (value && firstEmail && value !== firstEmail) {
       callback('The two email addresses do not match');
      }
      callback();
    } else {
      callback('Please input a valid email address!');
    }
  };

  return (
     <div className="create-tenant-user-container">
    
      <h2 className="create-tenant-user-header">Create {tenantId} User</h2>
      <Link to="/home">Return Home</Link>
      <Form
        name="create-tenant-user-form"
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
          <Input  />
        </Form.Item>


        <Form.Item
          label="Tenant"
          name="tenantId"
          initialValue={tenantId}
          hidden
        >
          <Input readOnly />
        </Form.Item>
        
        <Form.Item
          label="isAdmin"
          name="isAdmin"
          initialValue="false"
          hidden
        >
          <Input readOnly />
        </Form.Item> 
        


        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
            Create User
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
};

export default CreateTenantUser;

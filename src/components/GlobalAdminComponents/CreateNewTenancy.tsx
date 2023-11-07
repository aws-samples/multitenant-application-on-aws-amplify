/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 */

import React, { useState } from 'react';
import { Form, Input, Button, message } from 'antd';
import { API, Auth } from 'aws-amplify';
import { Link } from "react-router-dom";
import './GlobalAdminTenantStyles.css';
import TenantList from './TenantList';


interface CreateTenantAdminProps {
  tenantId?: string;
  userPoolId: string;
}

const CreateNewTenancy: React.FC<CreateTenantAdminProps> = ({ userPoolId }) => {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
        let apiName = 'AdminQueries';
        let path = '/tenancy/new';
        let myInit = {
            body: {
              "tenantId": values.tenantId,
              "isAdmin": values.isAdmin,
              "gsiProps": {
                "indexName": `${values.tenantId}-Index`
              },
              "groupName": values.tenantId,
              "userPoolId" : userPoolId,
              jwtToken: `Bearer ${(await Auth.currentSession()).getIdToken().getJwtToken()}`
            }, 
            headers: {
              'Content-Type' : 'application/json',
              Authorization: `Bearer ${(await Auth.currentSession()).getIdToken().getJwtToken()}`
            } 
        }

        await API.post(apiName, path, myInit);
        message.success('New Tenant Request Submitted');
        form.resetFields();
    } catch (error: any) {
        message.error(error.message);
    } finally {
        setLoading(false);
    }
  };

    
    const validateInput = (_ : any , value: any) => {
      if (value && /^[a-zA-Z0-9]*$/.test(value)) {
        return Promise.resolve();
      }
      return Promise.reject('Tenant name should not contain spaces or special characters');
    };
        

  return (
     <div className="center-content">
      <h3>Create New Tenant:</h3>
      <Link to="/home">Return Home</Link>

      <TenantList />

      <Form
        name="create-new-tenancy-form"
        layout="vertical"
        form={form}
        onFinish={onFinish}
      >


         <Form.Item
          label="isAdmin"
          name="isAdmin"
          initialValue="true"
          hidden
        >
          <Input readOnly />
        </Form.Item> 

        <Form.Item
          label="Enter Name of Tenant"
          name="tenantId"
          rules={[
            {
              validator: validateInput,
            },
            {
              required: true,
              message: 'Please provide a name for the new tenant!',
            },
          ]}
  
        >
           <Input />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
          Create New Tenant
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
};

export default CreateNewTenancy;
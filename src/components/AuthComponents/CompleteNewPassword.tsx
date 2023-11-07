/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 */

import React, { useState } from 'react';
import { Form, Input, Button, message } from 'antd';
import { Auth } from 'aws-amplify';
import {useNavigate,  Link} from "react-router-dom";

type CompleteNewPasswordProps = {
  user: any;
  setUser: React.Dispatch<React.SetStateAction<any>>;
  onSignInSuccess: (userObj: any) => any;
};

const CompleteNewPassword: React.FC<CompleteNewPasswordProps> = ({ user, setUser, onSignInSuccess}) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const onFinish = async () => {
    setIsLoading(true);

    try {
     const userObj = await Auth.completeNewPassword(user, newPassword);
      message.success('Password updated successfully!');
      setUser(null);
     // console.log("signed in user: ", userObj)
      onSignInSuccess(userObj)
    } catch (error: any) {
      message.error(error.message);
      setIsLoading(false);
    }
  };


  return (
    <Form
      name="complete_new_password"
      onFinish={onFinish}
      initialValues={{ remember: true }}
    >
        <Button type="link" onClick={() => navigate("/")}>
              Back to Login
        </Button>
<hr/>
      <Form.Item label="Username">
        <Input value={user?.challengeParam?.userAttributes?.email} disabled />
      </Form.Item>

      <Form.Item
        label="New Password"
        name="new_password"
        rules={[{ required: true, message: "Please input your new password!" }]}
      >
        <Input.Password
          value={newPassword}
          onChange={(e: any) => setNewPassword(e.target.value)}
        />
      </Form.Item>

      <Form.Item
        label="Confirm New Password"
        name="confirm_new_password"
        rules={[
          { required: true, message: "Please confirm your new password!" },
          ({ getFieldValue }) => ({
            validator(_, value) {
              if (!value || getFieldValue("new_password") === value) {
                return Promise.resolve();
              }
              return Promise.reject(
                new Error("The two passwords that you entered do not match!")
              );
            },
          }),
        ]}
      >
        <Input.Password
          value={confirmNewPassword}
          onChange={(e: any) => setConfirmNewPassword(e.target.value)}
        />
      </Form.Item>

      <Form.Item>
        <Button type="primary" htmlType="submit" loading={isLoading}>
          Complete New Password
        </Button>
      </Form.Item>
    </Form>
  );
};


export default CompleteNewPassword;
/* Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: MIT-0 */

import React, { useState } from "react";
import { Form, Input, Button } from "antd";
import { Auth } from "aws-amplify";
import { useNavigate } from "react-router-dom";

interface ConfirmationCodeInputProps {
  email: string;
  code?: string;
}

const ConfirmationCodeInput: React.FC<ConfirmationCodeInputProps> = ({ email, code }) => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleConfirm = async (values: { code: string }) => {
    setLoading(true);
    try {
      await Auth.confirmSignUp(email, values.code);
    } catch (error: any) {
      console.log("Error confirming sign up", error);
      if (error.code?.includes("NotAuthorizedException")) {
        navigate("/");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form onFinish={handleConfirm}>
      <Form.Item
        label="Email"
        name="email"
        initialValue={email}
      >
        <Input disabled />
      </Form.Item>
      <Form.Item
        label="Confirmation Code"
        name="code"
        initialValue={code}
        rules={[{ required: true, message: "Please enter the confirmation code" }]}
      >
        <Input />
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit" loading={loading}>
          Confirm
        </Button>
      </Form.Item>
    </Form>
  );
};

export default ConfirmationCodeInput;

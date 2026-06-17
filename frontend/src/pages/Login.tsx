import { App as AntdApp, Button, Card, Form, Input, Typography } from 'antd';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUserStore } from '@/store/userStore';
import { useEffect, useState } from 'react';

const { Title, Text, Paragraph } = Typography;

interface LoginForm {
  username: string;
  password: string;
}

export const Login = () => {
  const { message } = AntdApp.useApp();
  const [form] = Form.useForm<LoginForm>();
  const login = useUserStore((s) => s.login);
  const loading = useUserStore((s) => s.loading);
  const user = useUserStore((s) => s.user);
  const initFromStorage = useUserStore((s) => s.initFromStorage);
  const navigate = useNavigate();
  const location = useLocation();
  const [inited, setInited] = useState(false);

  useEffect(() => {
    initFromStorage();
    setInited(true);
  }, [initFromStorage]);

  useEffect(() => {
    if (inited && user) {
      const from = (location.state as { from?: Location } | null)?.from?.pathname || '/';
      navigate(from, { replace: true });
    }
  }, [inited, user, location.state, navigate]);

  const onSubmit = async (values: LoginForm) => {
    try {
      await login(values.username, values.password);
      message.success('登录成功');
      const from = (location.state as { from?: Location } | null)?.from?.pathname || '/';
      navigate(from, { replace: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : '登录失败';
      message.error(msg);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: 24,
      }}
    >
      <Card
        style={{
          width: 420,
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          borderRadius: 12,
        }}
        styles={{ body: { padding: 40 } }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              margin: '0 auto 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 28,
              fontWeight: 'bold',
              boxShadow: '0 8px 24px rgba(102,126,234,0.4)',
            }}
          >
            FT
          </div>
          <Title level={3} style={{ marginBottom: 4 }}>
            功能开关控制台
          </Title>
          <Text type="secondary">Feature Toggle Management Console</Text>
        </div>

        <Form<LoginForm>
          form={form}
          layout="vertical"
          size="large"
          onFinish={onSubmit}
          initialValues={{ username: '', password: '' }}
          autoComplete="off"
        >
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input
              prefix={<UserOutlined style={{ color: '#bbb' }} />}
              placeholder="请输入用户名"
            />
          </Form.Item>
          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#bbb' }} />}
              placeholder="请输入密码"
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 16 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              style={{
                height: 44,
                fontSize: 15,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
              }}
            >
              登 录
            </Button>
          </Form.Item>
        </Form>

        <Card
          size="small"
          style={{ background: '#f6f8fa', border: 'none' }}
          styles={{ body: { padding: 12 } }}
        >
          <Text type="secondary" style={{ fontSize: 12 }}>
            <Paragraph style={{ marginBottom: 8 }}>
              <strong>测试账号：</strong>
            </Paragraph>
            <Paragraph style={{ marginBottom: 4 }}>
              admin / 任意密码 → <b>管理员</b>（全权限）
            </Paragraph>
            <Paragraph style={{ marginBottom: 4 }}>
              dev / 任意密码 → <b>开发者</b>（不能操作 PROD）
            </Paragraph>
            <Paragraph style={{ marginBottom: 4 }}>
              tester / 任意密码 → <b>测试</b>
            </Paragraph>
            <Paragraph style={{ margin: 0 }}>
              pm / 任意密码 → <b>产品经理</b>
            </Paragraph>
          </Text>
        </Card>
      </Card>
    </div>
  );
};

export default Login;

import { LogoutOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import { Button, Layout, Menu, Typography } from 'antd'

import { useAuth } from '../auth/AuthProvider'

export function AppRoutes() {
  const { session, logout } = useAuth()
  return <Layout className="min-h-screen">
    <Layout.Sider theme="light" breakpoint="lg" collapsedWidth="0">
      <div className="flex items-center gap-2 p-5"><SafetyCertificateOutlined /><Typography.Text strong>ECP</Typography.Text></div>
      <Menu mode="inline" selectedKeys={['overview']} items={[{ key: 'overview', label: '概览' }]} />
    </Layout.Sider>
    <Layout>
      <Layout.Header className="flex items-center justify-between px-6">
        <Typography.Title level={4} className="m-0">企业控制台</Typography.Title>
        <div className="flex items-center gap-3"><Typography.Text>{session?.principal_id}</Typography.Text><Button icon={<LogoutOutlined />} onClick={() => void logout()}>退出</Button></div>
      </Layout.Header>
      <Layout.Content className="p-6"><CardSummary /></Layout.Content>
    </Layout>
  </Layout>
}

function CardSummary() { return <div className="grid gap-4 md:grid-cols-2"><div className="rounded-md border border-slate-200 bg-white p-6"><Typography.Title level={3}>企业能力已连接</Typography.Title><Typography.Paragraph>从这里统一管理身份、权限、凭证与审计。</Typography.Paragraph></div></div> }

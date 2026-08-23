import { AppstoreOutlined, AuditOutlined, IdcardOutlined, LogoutOutlined, SafetyCertificateOutlined, SettingOutlined, TeamOutlined, UserOutlined } from '@ant-design/icons'
import { Button, Card, Layout, Menu, Result, Spin, Typography } from 'antd'
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router'

import { RoleBindingEditor } from '../access/RoleBindingEditor'
import { ApplicationList } from '../applications/ApplicationList'
import { InstanceDetail } from '../applications/InstanceDetail'
import { AuditExport } from '../audit/AuditExport'
import { AuditList } from '../audit/AuditList'
import { useAuth } from '../auth/AuthProvider'
import { ServiceAccountList } from '../credentials/ServiceAccountList'
import { GroupList } from '../groups/GroupList'
import { GroupDetail } from '../groups/GroupDetail'
import { IdentitySourceList } from '../identity-sources/IdentitySourceList'
import { Health } from '../operations/Health'
import { BackupStatus } from '../operations/BackupStatus'
import { PolicyDrift } from '../security/PolicyDrift'
import { SecurityPolicy } from '../security/SecurityPolicy'
import { UserList } from '../users/UserList'
import { UserDetail } from '../users/UserDetail'
import { getInstance } from '../api/applications'
import { useAsync } from './useAsync'

const menuItems = [
  { key: '/overview', icon: <SafetyCertificateOutlined />, label: '概览' },
  { key: '/users', icon: <UserOutlined />, label: '用户' },
  { key: '/groups', icon: <TeamOutlined />, label: '用户组' },
  { key: '/identity-sources', icon: <IdcardOutlined />, label: '身份源' },
  { key: '/applications', icon: <AppstoreOutlined />, label: '应用与实例' },
  { key: '/security', icon: <SafetyCertificateOutlined />, label: '安全策略' },
  { key: '/credentials', icon: <IdcardOutlined />, label: '服务账号' },
  { key: '/audit', icon: <AuditOutlined />, label: '审计' },
  { key: '/operations', icon: <SettingOutlined />, label: '运行状态' },
]

export function AppRoutes() {
  const { session, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const selected = menuItems.find((item) => location.pathname.startsWith(item.key))?.key ?? '/overview'
  return <Layout className="min-h-screen">
    <Layout.Sider theme="light" breakpoint="lg" collapsedWidth="0">
      <div className="flex items-center gap-2 p-5"><SafetyCertificateOutlined /><Typography.Text strong>ECP</Typography.Text></div>
      <Menu mode="inline" selectedKeys={[selected]} items={menuItems} onClick={({ key }) => navigate(key)} />
    </Layout.Sider>
    <Layout>
      <Layout.Header className="flex items-center justify-between px-6">
        <Typography.Title level={4} className="m-0">企业控制台</Typography.Title>
        <div className="flex items-center gap-3"><Typography.Text>{session?.principal_id}</Typography.Text><Button icon={<LogoutOutlined />} onClick={() => void logout()}>退出</Button></div>
      </Layout.Header>
      <Layout.Content className="p-6"><Routes><Route path="/" element={<Navigate to="/overview" replace />} /><Route path="/overview" element={<Overview />} /><Route path="/users" element={<UserList />} /><Route path="/users/:userId" element={<UserRoute />} /><Route path="/groups" element={<GroupList />} /><Route path="/groups/:groupId" element={<GroupRoute />} /><Route path="/identity-sources" element={<IdentitySourceList />} /><Route path="/applications" element={<ApplicationList />} /><Route path="/applications/:instanceId" element={<InstanceRoute />} /><Route path="/applications/:instanceId/access" element={<AccessRoute />} /><Route path="/applications/:instanceId/security" element={<SecurityPage />} /><Route path="/applications/:instanceId/credentials" element={<CredentialPage />} /><Route path="/security" element={<SelectInstancePrompt />} /><Route path="/credentials" element={<SelectInstancePrompt />} /><Route path="/audit" element={<AuditPage />} /><Route path="/operations" element={<OperationsPage />} /><Route path="*" element={<Navigate to="/overview" replace />} /></Routes></Layout.Content>
    </Layout>
  </Layout>
}

function Overview() { return <div className="grid gap-4 md:grid-cols-2"><Card><Typography.Title level={3}>企业能力已连接</Typography.Title><Typography.Paragraph>统一管理身份、权限、凭据与审计。</Typography.Paragraph></Card><Card><Typography.Title level={3}>Manifest 驱动</Typography.Title><Typography.Paragraph>仅展示产品声明且企业已接受的角色、资源与能力。</Typography.Paragraph></Card></div> }
function UserRoute() { const { userId = '' } = useParams(); return <UserDetail userId={userId} /> }
function GroupRoute() { const { groupId = '' } = useParams(); return <GroupDetail groupId={groupId} /> }
function InstanceRoute() { const { instanceId = '' } = useParams(); return <InstanceDetail instanceId={instanceId} /> }
function AccessRoute() { const { instanceId = '' } = useParams(); const state = useAsync(() => getInstance(instanceId), [instanceId]); if (state.loading) return <Spin />; if (!state.data) return <Result status="error" title="无法加载实例 Manifest" />; return <RoleBindingEditor instanceId={instanceId} roles={state.data.manifest.roles} /> }
function SecurityPage() { const { instanceId = '' } = useParams(); return <div className="grid gap-6"><SecurityPolicy instanceId={instanceId} /><PolicyDrift instanceId={instanceId} /></div> }
function CredentialPage() { const { instanceId = '' } = useParams(); return <ServiceAccountList instanceId={instanceId} /> }
function SelectInstancePrompt() { return <Result status="info" title="请先选择应用实例" subTitle="安全策略和凭据始终绑定具体产品实例。" extra={<Button href="/applications">选择实例</Button>} /> }
function AuditPage() { return <div className="grid gap-6"><div className="flex justify-end"><AuditExport /></div><AuditList /></div> }
function OperationsPage() { return <div className="grid gap-6"><Health /><BackupStatus /></div> }

import { Alert, Button, Form, Input, Popconfirm, Select, Table, Typography } from 'antd'
import { useEffect, useState } from 'react'

import { createRoleBinding, listRoleBindings, revokeRoleBinding, type Resource, type RoleBinding } from '../api/access'
import { ResourcePicker } from './ResourcePicker'

export function RoleBindingEditor({ instanceId, roles }: { instanceId: string; roles: string[] }) {
  const [resource, setResource] = useState<Resource>()
  const [reauth, setReauth] = useState(false)
  const [bindings, setBindings] = useState<RoleBinding[]>([])
  const [loading, setLoading] = useState(true)
  const refresh = async () => { setLoading(true); try { setBindings(await listRoleBindings(instanceId)) } finally { setLoading(false) } }
  useEffect(() => { void refresh() }, [instanceId])
  return <section className="grid gap-4"><Typography.Title level={3}>角色绑定</Typography.Title>{reauth && <Alert type="warning" message="需要重新认证" />}<Table rowKey="id" loading={loading} dataSource={bindings} pagination={false} columns={[{ title: '主体', render: (_, value) => `${value.subject_type}:${value.subject_id}` }, { title: '角色', dataIndex: 'role' }, { title: '资源', render: (_, value) => `${value.resource.type}:${value.resource.id}` }, { title: '状态', dataIndex: 'status' }, { title: '操作', render: (_, value) => value.status === 'revoked' ? null : <Popconfirm title="确认撤销该角色绑定？" onConfirm={async () => { try { await revokeRoleBinding(instanceId, value.id); await refresh() } catch { setReauth(true) } }}><Button danger type="link">撤销</Button></Popconfirm> }]} /><Form layout="vertical" initialValues={{ subject_type: 'principal' }} onFinish={async (values: { subject_type: 'principal' | 'group'; subject_id: string; role: string }) => { if (!resource) return; try { await createRoleBinding(instanceId, { ...values, resource }); await refresh() } catch { setReauth(true) } }}><Form.Item label="主体类型" name="subject_type" rules={[{ required: true }]}><Select options={[{ value: 'principal', label: '用户' }, { value: 'group', label: '用户组' }]} /></Form.Item><Form.Item label="主体 ID" name="subject_id" rules={[{ required: true }]}><Input /></Form.Item><Form.Item label="固定角色" name="role" rules={[{ required: true }]}><Select options={roles.map((role) => ({ value: role, label: role }))} /></Form.Item><Form.Item label="资源" required><ResourcePicker instanceId={instanceId} onSelect={setResource} /></Form.Item><Button type="primary" htmlType="submit" disabled={!resource}>保存绑定</Button></Form></section>
}

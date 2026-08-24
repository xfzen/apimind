import { Alert, Button, Form, Input, Popconfirm, Select, Table, Typography } from 'antd'
import axios from 'axios'
import { useEffect, useState } from 'react'

import { createRoleBinding, listRoleBindings, revokeRoleBinding, type Resource, type RoleBinding } from '../api/access'
import { ResourcePicker } from './ResourcePicker'

export function RoleBindingEditor({ instanceId, roles, resourceTypes }: { instanceId: string; roles: string[]; resourceTypes: string[] }) {
  const [resource, setResource] = useState<Resource>()
  const [operationError, setOperationError] = useState<string>()
  const [bindings, setBindings] = useState<RoleBinding[]>([])
  const [loading, setLoading] = useState(true)
  const refresh = async () => { setLoading(true); try { setBindings(await listRoleBindings(instanceId)) } finally { setLoading(false) } }
  useEffect(() => { void refresh() }, [instanceId])
  return <section className="grid gap-4"><Typography.Title level={3}>角色绑定</Typography.Title>{operationError && <Alert type="error" message="角色绑定操作失败" description={operationError} closable onClose={() => setOperationError(undefined)} />}<Table rowKey="id" loading={loading} dataSource={bindings} pagination={false} columns={[{ title: '主体', render: (_, value) => `${value.subject_type}:${value.subject_id}` }, { title: '角色', dataIndex: 'role' }, { title: '资源', render: (_, value) => `${value.resource.type}:${value.resource.id}` }, { title: '状态', dataIndex: 'status' }, { title: '操作', render: (_, value) => value.status === 'revoked' ? null : <Popconfirm title="确认撤销该角色绑定？" onConfirm={async () => { setOperationError(undefined); try { await revokeRoleBinding(instanceId, value.id); await refresh() } catch (error) { setOperationError(errorMessage(error)) } }}><Button danger type="link">撤销</Button></Popconfirm> }]} /><Form layout="vertical" initialValues={{ subject_type: 'principal' }} onFinish={async (values: { subject_type: 'principal' | 'group'; subject_id: string; role: string }) => { if (!resource) return; setOperationError(undefined); try { await createRoleBinding(instanceId, { ...values, resource }); await refresh() } catch (error) { setOperationError(errorMessage(error)) } }}><Form.Item label="主体类型" name="subject_type" rules={[{ required: true }]}><Select options={[{ value: 'principal', label: '用户' }, { value: 'group', label: '用户组' }]} /></Form.Item><Form.Item label="主体 ID" name="subject_id" rules={[{ required: true }]}><Input /></Form.Item><Form.Item label="固定角色" name="role" rules={[{ required: true }]}><Select options={roles.map((role) => ({ value: role, label: role }))} /></Form.Item><Form.Item label="资源" required><ResourcePicker instanceId={instanceId} resourceTypes={resourceTypes} onSelect={setResource} /></Form.Item>{resource && <Typography.Text type="secondary">已选择 {resource.type}:{resource.id}</Typography.Text>}<Button type="primary" htmlType="submit" disabled={!resource}>保存绑定</Button></Form></section>
}

function errorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 401) return '会话已失效，请重新登录'
    const data = error.response?.data as { message?: string; error?: string } | undefined
    return data?.message ?? data?.error ?? error.message
  }
  return error instanceof Error ? error.message : '未知错误'
}

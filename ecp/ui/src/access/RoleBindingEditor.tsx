import { Alert, Button, Form, Input, Select, Typography } from 'antd'
import { useState } from 'react'

import { createRoleBinding, type Resource } from '../api/access'
import { ResourcePicker } from './ResourcePicker'

export function RoleBindingEditor({ instanceId, roles }: { instanceId: string; roles: string[] }) {
  const [resource, setResource] = useState<Resource>()
  const [reauth, setReauth] = useState(false)
  return <section className="grid gap-4"><Typography.Title level={3}>角色绑定</Typography.Title>{reauth && <Alert type="warning" message="需要重新认证" />}<Form layout="vertical" initialValues={{ subject_type: 'principal' }} onFinish={async (values: { subject_type: 'principal' | 'group'; subject_id: string; role: string }) => { if (!resource) return; try { await createRoleBinding(instanceId, { ...values, resource }) } catch { setReauth(true) } }}><Form.Item label="主体类型" name="subject_type" rules={[{ required: true }]}><Select options={[{ value: 'principal', label: '用户' }, { value: 'group', label: '用户组' }]} /></Form.Item><Form.Item label="主体 ID" name="subject_id" rules={[{ required: true }]}><Input /></Form.Item><Form.Item label="固定角色" name="role" rules={[{ required: true }]}><Select options={roles.map((role) => ({ value: role, label: role }))} /></Form.Item><Form.Item label="资源" required><ResourcePicker instanceId={instanceId} onSelect={setResource} /></Form.Item><Button type="primary" htmlType="submit" disabled={!resource}>保存绑定</Button></Form></section>
}

import { Alert, Button, Form, Input, Select, Typography } from 'antd'
import { useState } from 'react'

import { createRoleBinding } from '../api/access'
import { ResourcePicker } from './ResourcePicker'

export function RoleBindingEditor({ instanceId, roles }: { instanceId: string; roles: string[] }) {
  const [resourceId, setResourceId] = useState<string>()
  const [reauth, setReauth] = useState(false)
  return <section className="grid gap-4"><Typography.Title level={3}>角色绑定</Typography.Title>{reauth && <Alert type="warning" message="需要重新认证" />}<Form layout="vertical" onFinish={async (values: { principal_id: string; role: string }) => { try { await createRoleBinding(instanceId, { ...values, resource: resourceId ? { id: resourceId, name: '', type: '' } : undefined }) } catch { setReauth(true) } }}><Form.Item label="Principal" name="principal_id" rules={[{ required: true }]}><Input /></Form.Item><Form.Item label="固定角色" name="role" rules={[{ required: true }]}><Select options={roles.map((role) => ({ value: role, label: role }))} /></Form.Item><Form.Item label="资源"><ResourcePicker instanceId={instanceId} onSelect={setResourceId} /></Form.Item><Button type="primary" htmlType="submit">保存绑定</Button></Form></section>
}

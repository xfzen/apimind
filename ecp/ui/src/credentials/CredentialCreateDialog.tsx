import { Alert, Button, Form, Input, InputNumber, Modal, Typography } from 'antd'
import axios from 'axios'
import { useState } from 'react'

import { createCredential } from '../api/credentials'

type Values = { name: string; resourceType: string; resourceId: string; actions: string; lifetimeHours: number }

export function CredentialCreateDialog({ applicationId, instanceId, onCreated }: { applicationId: string; instanceId: string; onCreated: () => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [secret, setSecret] = useState<string>()
  const [error, setError] = useState<string>()
  return <><Button type="primary" onClick={() => { setError(undefined); setSecret(undefined); setOpen(true) }}>创建服务账号</Button><Modal open={open} title="创建服务账号" footer={null} onCancel={() => setOpen(false)}>{error && <Alert type="error" message="创建失败" description={error} />}{!secret && <Form layout="vertical" initialValues={{ lifetimeHours: 24 }} onFinish={async (values: Values) => { setError(undefined); try { const result = await createCredential({ applicationId, instanceId, name: values.name, resourceType: values.resourceType, resourceId: values.resourceId, actions: values.actions.split(',').map((value) => value.trim()).filter(Boolean), lifetimeSeconds: values.lifetimeHours * 3600 }); setSecret(result.secret); await onCreated() } catch (cause) { setError(errorMessage(cause)) } }}><Form.Item label="名称" name="name" rules={[{ required: true }]}><Input /></Form.Item><Form.Item label="资源类型" name="resourceType" rules={[{ required: true }]}><Input /></Form.Item><Form.Item label="资源 ID" name="resourceId" rules={[{ required: true }]}><Input /></Form.Item><Form.Item label="操作（逗号分隔）" name="actions" rules={[{ required: true }]}><Input /></Form.Item><Form.Item label="有效期（小时）" name="lifetimeHours" rules={[{ required: true }]}><InputNumber min={1} max={8760} /></Form.Item><Button type="primary" htmlType="submit">确认创建</Button></Form>}{secret && <Alert type="success" message="新密钥只显示一次" description={<Typography.Text copyable>{secret}</Typography.Text>} />}</Modal></>
}

function errorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 401) return '会话已失效，请重新登录'
    const data = error.response?.data as { message?: string; error?: string } | undefined
    return data?.message ?? data?.error ?? error.message
  }
  return error instanceof Error ? error.message : '未知错误'
}

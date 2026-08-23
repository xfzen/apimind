import { Alert, Button, Descriptions, Form, Input, Modal, Result, Spin, Typography } from 'antd'
import { useState } from 'react'

import { disableUser, getUser, mapLegacyIdentity, type User } from '../api/identity'
import { useAsync } from '../app/useAsync'

export function UserDetail({ userId, load = getUser }: { userId: string; load?: (id: string) => Promise<User> }) {
  const state = useAsync(() => load(userId), [load, userId])
  const [confirming, setConfirming] = useState(false)
  const [mapping, setMapping] = useState(false)
  if (state.loading) return <Spin />
  if (!state.data) return <Result status="error" title="无法加载用户" />
  return (
    <section className="grid gap-4">
      <Typography.Title level={2}>{state.data.display_name}</Typography.Title>
      {state.data.state === 'pending_external_sync' && <Alert type="warning" message="等待外部目录对账" />}
      <Descriptions bordered items={[{ key: 'state', label: '状态', children: state.data.state }, { key: 'source', label: '来源', children: state.data.source ?? 'local' }]} />
      <div className="flex gap-3">
        <Button onClick={() => setMapping(true)}>映射旧产品账号</Button>
        <Button danger onClick={() => setConfirming(true)}>停用用户</Button>
      </div>
      <Modal title="映射旧产品账号" open={mapping} footer={null} onCancel={() => setMapping(false)}>
        <Form
          layout="vertical"
          onFinish={async (values: { application_id: string; legacy_subject: string }) => {
            await mapLegacyIdentity(values.application_id, userId, values.legacy_subject)
            setMapping(false)
          }}
        >
          <Form.Item name="application_id" label="应用 ID" rules={[{ required: true }]}>
            <Input placeholder="apimind" />
          </Form.Item>
          <Form.Item name="legacy_subject" label="旧用户 ID" rules={[{ required: true }]}>
            <Input placeholder="例如 42" />
          </Form.Item>
          <Alert className="mb-4" type="info" message="映射不可改绑；如发现冲突将拒绝保存。" />
          <Button type="primary" htmlType="submit">保存映射</Button>
        </Form>
      </Modal>
      <Modal title="高风险操作" open={confirming} onCancel={() => setConfirming(false)} onOk={() => void disableUser(userId)}>
        重新认证后停用
      </Modal>
    </section>
  )
}

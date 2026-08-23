import { Alert, Button, Descriptions, Modal, Result, Spin, Typography } from 'antd'
import { useState } from 'react'

import { disableUser, getUser, type User } from '../api/identity'
import { useAsync } from '../app/useAsync'

export function UserDetail({ userId, load = getUser }: { userId: string; load?: (id: string) => Promise<User> }) {
  const state = useAsync(() => load(userId), [load, userId])
  const [confirming, setConfirming] = useState(false)
  if (state.loading) return <Spin />
  if (!state.data) return <Result status="error" title="无法加载用户" />
  return <section className="grid gap-4"><Typography.Title level={2}>{state.data.display_name}</Typography.Title>{state.data.state === 'pending_external_sync' && <Alert type="warning" message="等待外部目录对账" />}<Descriptions bordered items={[{ key: 'state', label: '状态', children: state.data.state }, { key: 'source', label: '来源', children: state.data.source ?? 'local' }]} /><Button danger onClick={() => setConfirming(true)}>停用用户</Button><Modal title="高风险操作" open={confirming} onCancel={() => setConfirming(false)} onOk={() => void disableUser(userId)}>重新认证后停用</Modal></section>
}

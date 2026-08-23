import { Alert, Button, Form, Input, List, Result, Spin, Typography } from 'antd'
import { useState } from 'react'

import { getPolicyDrift, repairPolicy, type PolicyDriftState } from '../api/security'
import { useAsync } from '../app/useAsync'

export function PolicyDrift({ instanceId = '', load }: { instanceId?: string; load?: () => Promise<PolicyDriftState> }) {
  const state = useAsync(() => load ? load() : getPolicyDrift(), [instanceId, load])
  const [reauth, setReauth] = useState(false)
  if (state.loading) return <Spin />
  if (!state.data) return <Result status="error" title="无法加载策略漂移" />
  return <section className="grid gap-4"><Typography.Title level={3}>策略漂移</Typography.Title>{!state.data.drifted ? <Alert type="success" message="策略一致" /> : <><Alert type="warning" message="检测到策略漂移" /><List bordered dataSource={state.data.fields} renderItem={(field) => <List.Item>{field}</List.Item>} /><Form onFinish={async ({ reason }: { reason: string }) => { try { await repairPolicy(reason, instanceId) } catch { setReauth(true) } }}><Form.Item label="修复原因" name="reason" rules={[{ required: true }]}><Input /></Form.Item><Button htmlType="submit">修复策略</Button></Form>{reauth && <Alert type="warning" message="需要重新认证" />}</>}</section>
}

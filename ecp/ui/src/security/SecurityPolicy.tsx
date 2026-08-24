import { Descriptions, Result, Spin, Tag, Typography } from 'antd'

import { getSecurityPolicy, type SecurityPolicySchema } from '../api/security'
import { useAsync } from '../app/useAsync'

export function SecurityPolicy({ instanceId = '', load }: { instanceId?: string; load?: () => Promise<SecurityPolicySchema | null> }) {
  const state = useAsync(() => load ? load() : getSecurityPolicy(instanceId), [instanceId, load])
  if (state.loading) return <Spin />
  if (state.error || state.data === undefined) return <Result status="error" title="无法加载安全策略" />
  if (state.data === null) return <Result status="info" title="尚未配置安全策略" />
  return <section className="grid gap-4"><Typography.Title level={2}>安全策略</Typography.Title><Descriptions bordered items={[{ key: 'sharing', label: '公开分享', children: <Tag>{state.data.public_sharing ? '允许' : '禁止'}</Tag> }, { key: 'export', label: '导出策略', children: <Tag>{state.data.export_allowed ? '允许' : '禁止'}</Tag> }, { key: 'secret', label: '密钥策略', children: <Tag>{state.data.secret_policy}</Tag> }]} /></section>
}

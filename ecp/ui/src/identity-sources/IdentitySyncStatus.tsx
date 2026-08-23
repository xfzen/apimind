import { Alert, Descriptions, Result, Spin, Typography } from 'antd'

import { getIdentitySourceStatus, type IdentitySourceStatus as Status } from '../api/identitySources'
import { useAsync } from '../app/useAsync'

export function IdentitySyncStatus({ sourceId, load = getIdentitySourceStatus }: { sourceId: string; load?: (id: string) => Promise<Status> }) {
  const state = useAsync(() => load(sourceId), [load, sourceId])
  if (state.loading) return <Spin />
  if (!state.data) return <Result status="error" title="无法加载同步状态" />
  const status = state.data
  return <section className="grid gap-4"><Typography.Title level={3}>目录同步</Typography.Title>{status.failure && <Alert type="error" message={status.failure} />}<Descriptions bordered items={[{ key: 'provider', label: 'Provider', children: status.provider }, { key: 'last', label: '最近成功', children: status.last_success_at }, { key: 'fresh', label: 'Freshness Deadline', children: status.freshness_deadline }, { key: 'lag', label: '延迟（秒）', children: status.lag_seconds }, { key: 'reconciliation', label: '对账状态', children: status.reconciliation_state }]} /></section>
}

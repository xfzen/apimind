import { Alert, Descriptions, Result, Spin, Typography } from 'antd'

import { apiClient } from '../api/client'
import { useAsync } from '../app/useAsync'

type HealthState = { status: string; version: string; database?: string; casdoor?: string }
async function loadHealth() { return (await apiClient.get<HealthState>('/meta/health')).data }

export function Health({ load = loadHealth }: { load?: () => Promise<HealthState> }) {
  const state = useAsync(load)
  if (state.loading) return <Spin />
  if (!state.data) return <Result status="error" title="无法加载运行状态" />
  return <section className="grid gap-4"><Typography.Title level={2}>运行状态</Typography.Title><Alert type={state.data.status === 'ok' ? 'success' : 'warning'} message={state.data.status} /><Descriptions bordered items={[{ key: 'version', label: '版本', children: state.data.version }, { key: 'db', label: '数据库', children: state.data.database ?? '—' }, { key: 'casdoor', label: 'Casdoor', children: state.data.casdoor ?? '—' }]} /></section>
}

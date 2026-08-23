import { Alert, Descriptions, Typography } from 'antd'

export type IdentityFreshness = { stale: boolean; lag_seconds: number; freshness_deadline: string }

export function StaleIdentityAlert({ state }: { state: IdentityFreshness }) {
  if (!state.stale) return <Alert type="success" message="身份数据新鲜" />
  return <Alert type="error" message="身份数据已过期" description={`同步延迟 ${state.lag_seconds} 秒；Freshness Deadline ${state.freshness_deadline}`} />
}

export function IdentitySyncStatus({ state }: { state: IdentityFreshness }) {
  return <section className="grid gap-4"><Typography.Title level={2}>身份同步</Typography.Title><StaleIdentityAlert state={state} /><Descriptions bordered items={[{ key: 'lag', label: '延迟（秒）', children: state.lag_seconds }, { key: 'deadline', label: 'Freshness Deadline', children: state.freshness_deadline }]} /></section>
}

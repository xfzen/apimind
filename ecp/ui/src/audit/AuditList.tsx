import { List, Result, Spin, Tag, Typography } from 'antd'

import { listAuditEvents, type AuditEvent } from '../api/audit'
import { useAsync } from '../app/useAsync'

export function AuditList({ load = listAuditEvents }: { load?: () => Promise<AuditEvent[]> }) {
  const state = useAsync(load)
  if (state.loading) return <Spin />
  if (!state.data) return <Result status="error" title="无法加载审计" />
  return <section className="grid gap-4"><Typography.Title level={2}>审计</Typography.Title><List bordered dataSource={state.data} renderItem={(event) => <List.Item extra={<Tag>{event.outcome}</Tag>}><List.Item.Meta title={`${event.actor} · ${event.action}`} description={`${event.occurred_at}${event.target ? ` · ${event.target}` : ''}`} /></List.Item>} /></section>
}

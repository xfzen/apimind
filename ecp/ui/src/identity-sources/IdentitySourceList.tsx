import { List, Result, Spin, Tag, Typography } from 'antd'

import { listIdentitySources, type IdentitySource } from '../api/identitySources'
import { useAsync } from '../app/useAsync'

export function IdentitySourceList({ load = listIdentitySources }: { load?: () => Promise<IdentitySource[]> }) {
  const state = useAsync(load)
  if (state.loading) return <Spin />
  if (!state.data) return <Result status="error" title="无法加载身份源" />
  return <section className="grid gap-4"><Typography.Title level={2}>身份源</Typography.Title><List bordered dataSource={state.data} renderItem={(source) => <List.Item extra={<Tag>{source.state}</Tag>}><List.Item.Meta title={source.name} description={source.provider} /></List.Item>} /></section>
}

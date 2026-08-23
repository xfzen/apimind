import { List, Result, Spin, Tag, Typography } from 'antd'

import { listServiceAccounts, type ServiceAccount } from '../api/credentials'
import { useAsync } from '../app/useAsync'

export function ServiceAccountList({ instanceId = '', load }: { instanceId?: string; load?: () => Promise<ServiceAccount[]> }) {
  const state = useAsync(() => load ? load() : listServiceAccounts(instanceId), [instanceId, load])
  if (state.loading) return <Spin />
  if (!state.data) return <Result status="error" title="无法加载服务账号" />
  return <section className="grid gap-4"><Typography.Title level={2}>服务账号</Typography.Title><List bordered dataSource={state.data} renderItem={(account) => <List.Item extra={<Tag>{account.state}</Tag>}><List.Item.Meta title={account.name} description={account.scopes.join(' · ')} /></List.Item>} /></section>
}

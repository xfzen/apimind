import { List, Result, Spin, Tag, Typography } from 'antd'
import { Link } from 'react-router'

import { listGroups, type Group } from '../api/identity'
import { useAsync } from '../app/useAsync'

export function GroupList({ load = listGroups }: { load?: () => Promise<Group[]> }) {
  const state = useAsync(load)
  if (state.loading) return <Spin />
  if (!state.data) return <Result status="error" title="无法加载用户组" />
  return <section className="grid gap-4"><Typography.Title level={2}>用户组</Typography.Title><List bordered dataSource={state.data} renderItem={(group) => <List.Item extra={<Tag>{group.source}</Tag>}><Link to={`/groups/${group.id}`}>{group.name}</Link></List.Item>} /></section>
}

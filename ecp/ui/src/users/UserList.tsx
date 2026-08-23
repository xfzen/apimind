import { List, Result, Spin, Tag, Typography } from 'antd'
import { Link } from 'react-router'

import { listUsers, type User } from '../api/identity'
import { useAsync } from '../app/useAsync'

export function UserList({ load = listUsers }: { load?: () => Promise<User[]> }) {
  const state = useAsync(load)
  if (state.loading) return <Spin />
  if (!state.data) return <Result status="error" title="无法加载用户" />
  return <section className="grid gap-4"><Typography.Title level={2}>用户</Typography.Title><List bordered dataSource={state.data} renderItem={(user) => <List.Item extra={<Tag>{user.state}</Tag>}><List.Item.Meta title={<Link to={`/users/${user.id}`}>{user.display_name}</Link>} description={user.email ?? user.id} /></List.Item>} /></section>
}

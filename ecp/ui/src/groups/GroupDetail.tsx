import { Alert, Button, List, Result, Spin, Typography } from 'antd'

import { getGroup, type Group } from '../api/identity'
import { useAsync } from '../app/useAsync'

export function GroupDetail({ groupId, load = getGroup }: { groupId: string; load?: (id: string) => Promise<Group> }) {
  const state = useAsync(() => load(groupId), [groupId, load])
  if (state.loading) return <Spin />
  if (!state.data) return <Result status="error" title="无法加载用户组" />
  const managed = state.data.source === 'directory_managed'
  return <section className="grid gap-4"><Typography.Title level={2}>{state.data.name}</Typography.Title>{managed && <Alert type="info" message="由外部目录管理" />}<Button disabled={managed}>添加成员</Button><List bordered dataSource={state.data.members} renderItem={(member) => <List.Item>{member.display_name}</List.Item>} /></section>
}

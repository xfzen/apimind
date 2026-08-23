import { Descriptions, Result, Spin, Tag, Typography } from 'antd'

import { getInstance, type ApplicationInstance } from '../api/applications'
import { useAsync } from '../app/useAsync'

export function InstanceDetail({ instanceId, load = getInstance }: { instanceId: string; load?: (id: string) => Promise<ApplicationInstance> }) {
  const state = useAsync(() => load(instanceId), [instanceId, load])
  if (state.loading) return <Spin />
  if (!state.data) return <Result status="error" title="无法加载实例" />
  const instance = state.data
  return <section className="grid gap-4"><Typography.Title level={2}>{instance.name}</Typography.Title><Descriptions bordered items={[{ key: 'state', label: '状态', children: instance.state }, { key: 'url', label: '入口', children: instance.base_url }]} /><Typography.Title level={4}>固定角色</Typography.Title><div className="flex flex-wrap gap-2">{instance.manifest.roles.map((role) => <Tag key={role}>{role}</Tag>)}</div><Typography.Title level={4}>资源类型</Typography.Title><div className="flex flex-wrap gap-2">{instance.manifest.resource_types.map((type) => <Tag key={type}>{type}</Tag>)}</div></section>
}

import { List, Result, Spin, Tag, Typography } from 'antd'
import { Link } from 'react-router'

import { listApplications, type Application } from '../api/applications'
import { useAsync } from '../app/useAsync'

export function ApplicationList({ load = listApplications }: { load?: () => Promise<Application[]> }) {
  const state = useAsync(load)
  if (state.loading) return <Spin />
  if (!state.data) return <Result status="error" title="无法加载应用" />
  return <section className="grid gap-4"><Typography.Title level={2}>应用</Typography.Title><List bordered dataSource={state.data} renderItem={(app) => <List.Item><List.Item.Meta title={app.name} description={<div className="grid gap-2">{(app.instances ?? []).map((instance) => <div className="flex flex-wrap items-center gap-3" key={instance.id}><Link to={`/applications/${instance.id}`}>{instance.name}</Link><Tag>{instance.state}</Tag><Link to={`/applications/${instance.id}/access`}>授权</Link><Link to={`/applications/${instance.id}/security`}>安全</Link><Link to={`/applications/${instance.id}/credentials`}>凭据</Link></div>)}</div>} /></List.Item>} /></section>
}

import { List, Result, Spin, Tag, Typography } from 'antd'
import { useEffect, useState } from 'react'

import { listServiceAccounts, type ServiceAccount } from '../api/credentials'
import { CredentialCreateDialog } from './CredentialCreateDialog'
import { CredentialRotateDialog } from './CredentialRotateDialog'

export function ServiceAccountList({ applicationId = '', instanceId = '', load }: { applicationId?: string; instanceId?: string; load?: () => Promise<ServiceAccount[]> }) {
  const [accounts, setAccounts] = useState<ServiceAccount[]>()
  const [failed, setFailed] = useState(false)
  const refresh = async () => { setFailed(false); try { setAccounts(await (load ? load() : listServiceAccounts(instanceId))) } catch { setFailed(true) } }
  useEffect(() => { void refresh() }, [instanceId, load])
  if (!accounts && !failed) return <Spin />
  if (failed) return <Result status="error" title="无法加载服务账号" />
  return <section className="grid gap-4"><div className="flex items-center justify-between"><Typography.Title level={2} className="m-0">服务账号</Typography.Title>{applicationId && instanceId && <CredentialCreateDialog applicationId={applicationId} instanceId={instanceId} onCreated={refresh} />}</div><List bordered dataSource={accounts} renderItem={(account) => <List.Item extra={<div className="flex items-center gap-3"><Tag>{account.state}</Tag>{account.state === 'active' && <CredentialRotateDialog accountId={account.id} />}</div>}><List.Item.Meta title={account.name} description={account.scopes.join(' · ')} /></List.Item>} /></section>
}

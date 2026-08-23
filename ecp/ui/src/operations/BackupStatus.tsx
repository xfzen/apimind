import { Alert, Card, Descriptions, Spin, Typography } from 'antd'

import { getBackupStatus, type BackupStatus as BackupStatusValue } from '../api/operations'
import { useAsync } from '../app/useAsync'

const messages: Record<BackupStatusValue['state'], { type: 'success' | 'error' | 'warning' | 'info'; text: string }> = {
  verified: { type: 'success', text: '最近一次备份已通过空环境恢复验证' },
  failed: { type: 'error', text: '最近一次备份或恢复验证失败' },
  in_progress: { type: 'info', text: '备份正在进行' },
  completed: { type: 'warning', text: '备份已完成，但尚未通过空环境恢复验证' },
  never_run: { type: 'warning', text: '尚未执行受支持的备份' },
}

export function BackupStatus({ load = getBackupStatus }: { load?: () => Promise<BackupStatusValue> }) {
  const state = useAsync(load, [load])
  if (state.loading) return <Spin />
  if (!state.data) return <Alert type="error" message="无法读取备份状态" />
  const message = messages[state.data.state]
  return (
    <Card>
      <Typography.Title level={3}>备份与恢复</Typography.Title>
      <Alert type={message.type} message={message.text} showIcon />
      <Descriptions
        className="mt-4"
        column={1}
        items={[
          { key: 'backup', label: '备份 ID', children: state.data.backup_id ?? '—' },
          { key: 'hash', label: 'Manifest 校验', children: state.data.manifest_hash ?? '—' },
          { key: 'reason', label: '失败原因', children: state.data.failure_reason ?? '—' },
        ]}
      />
    </Card>
  )
}

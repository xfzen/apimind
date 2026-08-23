import { Alert, Button, Form, Input, Modal } from 'antd'
import { useState } from 'react'

import { prepareAuditExport, type AuditExportPreparation } from '../api/audit'

export function AuditExport({ prepare = prepareAuditExport }: { prepare?: (reason: string) => Promise<AuditExportPreparation> }) {
  const [open, setOpen] = useState(false)
  const [reauth, setReauth] = useState(false)
  const [ready, setReady] = useState<string>()
  return <><Button onClick={() => setOpen(true)}>导出审计</Button><Modal title="导出审计" open={open} footer={null} onCancel={() => setOpen(false)}>{reauth && <Alert type="warning" message="需要重新认证" />}{ready && <Alert type="success" message={`导出任务 ${ready} 已创建`} />}<Form layout="vertical" onFinish={async ({ reason }: { reason: string }) => { const result = await prepare(reason); if (result.status === 'reauth_required') setReauth(true); else setReady(result.export_id) }}><Form.Item label="导出原因" name="reason" rules={[{ required: true }]}><Input aria-label="导出原因" /></Form.Item><Button type="primary" htmlType="submit">创建导出</Button></Form></Modal></>
}

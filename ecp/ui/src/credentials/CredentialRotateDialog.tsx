import { Alert, Button, Form, Input, Modal, Typography } from 'antd'
import { useState } from 'react'

import { rotateCredential } from '../api/credentials'

export function CredentialRotateDialog({ accountId, onRotated }: { accountId: string; onRotated?: () => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [reauth, setReauth] = useState(false)
  const [secret, setSecret] = useState<string>()
  return <><Button onClick={() => setOpen(true)}>轮换凭据</Button><Modal open={open} title="轮换凭据" footer={null} onCancel={() => setOpen(false)}>{reauth && <Alert type="warning" message="需要重新认证" />}<Form layout="vertical" onFinish={async ({ reason }: { reason: string }) => { const result = await rotateCredential(accountId, reason); if (result.status === 'reauth_required') setReauth(true); else { setSecret(result.secret); await onRotated?.() } }}><Form.Item label="轮换原因" name="reason" rules={[{ required: true }]}><Input /></Form.Item><Button danger htmlType="submit">确认轮换</Button></Form>{secret && <Alert type="success" message="新密钥只显示一次" description={<Typography.Text copyable>{secret}</Typography.Text>} />}</Modal></>
}

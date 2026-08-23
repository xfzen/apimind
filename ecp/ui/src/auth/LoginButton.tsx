import { LoginOutlined } from '@ant-design/icons'
import { Button, Typography } from 'antd'
import { useState } from 'react'

import { startAdminLogin } from '../api/auth'

type Props = { navigate?: (path: string) => void; startLogin?: () => Promise<string> }
export function LoginButton({ navigate = (path) => window.location.assign(path), startLogin = startAdminLogin }: Props) {
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const login = async () => {
    setLoading(true)
    setFailed(false)
    try { navigate(await startLogin()) }
    catch { setFailed(true); setLoading(false) }
  }
  return <div className="grid gap-2">
    <Button aria-label="登录" type="primary" icon={<LoginOutlined />} loading={loading} onClick={() => void login()}>登录</Button>
    {failed ? <Typography.Text role="alert" type="danger">登录服务暂时不可用，请稍后重试。</Typography.Text> : null}
  </div>
}

import { LockOutlined } from '@ant-design/icons'
import { Card, Result, Spin } from 'antd'
import type { PropsWithChildren } from 'react'

import { useAuth } from './AuthProvider'
import { AuthCallback } from './callback'
import { LoginButton } from './LoginButton'

export function RequireSession({ children }: PropsWithChildren) {
  const { loading, session } = useAuth()
  if (window.location.pathname === '/auth/callback') return <AuthCallback />
  if (loading) return <div className="flex min-h-screen items-center justify-center"><Spin size="large" /></div>
  if (!session) return <div className="flex min-h-screen items-center justify-center p-6"><Card className="w-full max-w-md"><Result icon={<LockOutlined />} title="企业控制台" subTitle="请使用企业身份登录。" extra={<LoginButton />} /></Card></div>
  return <>{children}</>
}

import { Result, Spin } from 'antd'
import { useEffect, useState } from 'react'

import { apiClient } from '../api/client'
import { useAuth } from './AuthProvider'

export function AuthCallback() {
  const { refresh } = useAuth()
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const query = new URLSearchParams(window.location.search)
    apiClient.get('/auth/callback', { params: Object.fromEntries(query.entries()) }).then(refresh).then(() => window.location.replace('/')).catch(() => setFailed(true))
  }, [refresh])
  if (failed) return <Result status="error" title="登录未完成" subTitle="请返回并重新登录。" />
  return <div className="flex min-h-screen items-center justify-center"><Spin size="large" /></div>
}

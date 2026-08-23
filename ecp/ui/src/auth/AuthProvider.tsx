import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react'

import { apiClient, setSessionScope } from '../api/client'

export type SessionSummary = { id: string; principal_id: string; enterprise_id: string; expires_at: number; csrf_token: string }
type AuthState = { loading: boolean; session: SessionSummary | null; refresh: () => Promise<void>; logout: () => Promise<void> }
const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: PropsWithChildren) {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<SessionSummary | null>(null)

  const clear = useCallback(() => { setSession(null); setSessionScope('', '') }, [])
  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const response = await apiClient.get<SessionSummary>('/auth/session')
      setSession(response.data)
      setSessionScope(response.data.enterprise_id, response.data.csrf_token)
    } catch (error) {
      if (axiosStatus(error) === 401) clear()
      else clear()
    } finally { setLoading(false) }
  }, [clear])
  const logout = useCallback(async () => { try { await apiClient.post('/auth/logout') } finally { clear() } }, [clear])
  useEffect(() => { void refresh() }, [refresh])
  const value = useMemo(() => ({ loading, session, refresh, logout }), [loading, session, refresh, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('AuthProvider is required')
  return value
}

function axiosStatus(error: unknown) {
  return typeof error === 'object' && error !== null && 'response' in error ? (error as { response?: { status?: number } }).response?.status : undefined
}

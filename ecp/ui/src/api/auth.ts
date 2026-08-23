import { apiClient } from './client'

type AuthStartResponse = { authorization_url: string }

export async function startAdminLogin() {
  const response = await apiClient.get<AuthStartResponse>('/auth/start')
  if (!response.data.authorization_url) throw new Error('authorization_url_missing')
  return response.data.authorization_url
}

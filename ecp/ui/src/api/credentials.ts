import { apiClient } from './client'

export type ServiceAccount = { id: string; name: string; scopes: string[]; state: string; last_used_at?: string }
export type CredentialResult = { status: 'ok' | 'reauth_required'; secret?: string }

type CredentialWire = { id: string; name: string; scopes: Array<{ resource_type: string; resource_id: string; actions: string[] }>; status: string; last_used_at?: number }
export async function listServiceAccounts(instanceId = 'default') { const values = (await apiClient.get<{ credentials: CredentialWire[] }>(`/instances/${encodeURIComponent(instanceId)}/credentials`)).data.credentials; return values.map((value) => ({ id: value.id, name: value.name, scopes: value.scopes.flatMap((scope) => scope.actions.map((action) => `${scope.resource_type}:${scope.resource_id}:${action}`)), state: value.status, last_used_at: value.last_used_at ? new Date(value.last_used_at * 1000).toISOString() : undefined })) }
export async function rotateCredential(id: string, reason: string): Promise<CredentialResult> { const value = (await apiClient.post<{ secret?: string }>(`/credentials/${encodeURIComponent(id)}/rotate`, { reason, lifetime_seconds: 3600 })).data; return { status: 'ok', secret: value.secret } }

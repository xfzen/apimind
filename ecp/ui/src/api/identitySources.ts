import { apiClient } from './client'

export type IdentitySource = { id: string; name: string; provider: string; state: string }
export type IdentitySourceStatus = { provider: string; last_success_at: string; freshness_deadline: string; lag_seconds: number; failure?: string; reconciliation_state: string }

type SourceWire = { id: string; provider: string; state: string; last_successful_sync?: number; freshness_deadline?: number; last_error?: string }
export async function listIdentitySources() { return (await apiClient.get<{ sources: SourceWire[] }>('/identity/sources')).data.sources.map((value) => ({ id: value.id, name: value.provider, provider: value.provider, state: value.state })) }
export async function getIdentitySourceStatus(id: string) { const values = (await apiClient.get<{ sources: SourceWire[] }>('/identity/sources')).data.sources; const value = values.find((source) => source.id === id); if (!value) throw new Error('identity_source_not_found'); const deadline = value.freshness_deadline ? new Date(value.freshness_deadline * 1000) : undefined; return { provider: value.provider, last_success_at: value.last_successful_sync ? new Date(value.last_successful_sync * 1000).toISOString() : '', freshness_deadline: deadline?.toISOString() ?? '', lag_seconds: value.last_successful_sync ? Math.max(0, Math.floor(Date.now() / 1000) - value.last_successful_sync) : 0, failure: value.last_error, reconciliation_state: value.state } }

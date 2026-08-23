import { apiClient } from './client'

export type AuditEvent = { id: string; occurred_at: string; actor: string; action: string; outcome: string; target?: string }
export type AuditExportPreparation = { status: 'ready' | 'reauth_required'; export_id?: string }

type AuditWire = { id: string; occurred_at: number; actor_id: string; action: string; outcome: string; resource_id?: string }
export async function listAuditEvents() { const values = (await apiClient.get<{ events: AuditWire[] }>('/audit/events')).data.events; return values.map((value) => ({ id: value.id, occurred_at: new Date(value.occurred_at * 1000).toISOString(), actor: value.actor_id, action: value.action, outcome: value.outcome, target: value.resource_id })) }
export async function prepareAuditExport(reason: string) { const value = (await apiClient.post<{ canonical_hash: string }>('/audit/export', { reason })).data; return { status: 'ready', export_id: value.canonical_hash } satisfies AuditExportPreparation }

import { apiClient } from './client'

export type SecurityPolicySchema = { public_sharing: boolean; export_allowed: boolean; secret_policy: 'redact' | 'deny' }
export type PolicyDriftState = { drifted: boolean; fields: string[] }

type SecurityWire = { public_sharing: boolean; export_enabled: boolean; secret_export: boolean }
export async function getSecurityPolicy(instanceId = 'default') { const value = (await apiClient.get<SecurityWire>(`/instances/${encodeURIComponent(instanceId)}/security`)).data; return { public_sharing: value.public_sharing, export_allowed: value.export_enabled, secret_policy: value.secret_export ? 'redact' as const : 'deny' as const } }
export async function getPolicyDrift() { return { drifted: false, fields: [] } satisfies PolicyDriftState }
export async function repairPolicy(reason: string, instanceId = 'default') { return apiClient.post(`/instances/${encodeURIComponent(instanceId)}/policies/reconcile`, { reason, manifest_version: 0, policies: [] }) }

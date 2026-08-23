import { apiClient } from './client'

export type User = { id: string; display_name: string; email?: string; state: 'active' | 'blocked' | 'pending_external_sync'; source?: string }
export type Group = { id: string; name: string; source: 'local' | 'directory_managed'; members: User[] }

type PrincipalWire = { id: string; display_name: string; normalized_email?: string; status: User['state']; issuer?: string }
type GroupWire = { id: string; name: string; management_mode: 'ecp_managed' | 'directory_managed' }
const mapUser = (value: PrincipalWire): User => ({ id: value.id, display_name: value.display_name, email: value.normalized_email, state: value.status, source: value.issuer })
const mapGroup = (value: GroupWire, members: User[] = []): Group => ({ id: value.id, name: value.name, source: value.management_mode === 'directory_managed' ? 'directory_managed' : 'local', members })

export async function listUsers() { return (await apiClient.get<{ principals: PrincipalWire[] }>('/identity/principals')).data.principals.map(mapUser) }
export async function getUser(id: string) { return mapUser((await apiClient.get<PrincipalWire>(`/identity/principals/${encodeURIComponent(id)}`)).data) }
export async function getGroup(id: string) { const data = (await apiClient.get<{ group: GroupWire; principal_ids: string[] }>(`/identity/groups/${encodeURIComponent(id)}`)).data; return mapGroup(data.group, data.principal_ids.map((principalID) => ({ id: principalID, display_name: principalID, state: 'active' }))) }
export async function listGroups() { return (await apiClient.get<{ groups: GroupWire[] }>('/identity/groups')).data.groups.map((value) => mapGroup(value)) }
export async function disableUser(id: string) { return apiClient.post(`/identity/principals/${encodeURIComponent(id)}/block`, {}) }
export async function mapLegacyIdentity(applicationId: string, principalId: string, legacySubject: string) { return apiClient.post(`/applications/${encodeURIComponent(applicationId)}/legacy-identities`, { principal_id: principalId, legacy_source: 'yapi_user_id', legacy_subject: legacySubject }) }

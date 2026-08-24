import { apiClient } from './client'

export type Resource = { id: string; name: string; type: string }
export type ResourceSearch = { reason?: 'resource_not_visible'; resources: Resource[] }
export type RoleBinding = { id: string; subject_type: 'principal' | 'group'; subject_id: string; role: string; resource: Resource; status?: string }

export async function searchResources(instanceId: string, resourceType: string, query: string) {
	return (await apiClient.get<ResourceSearch>(`/application-instances/${encodeURIComponent(instanceId)}/resources`, { params: { resource_type: resourceType, query } })).data
}
export async function listRoleBindings(instanceId: string) { return (await apiClient.get<{ items: RoleBinding[] }>(`/application-instances/${encodeURIComponent(instanceId)}/role-bindings`)).data.items }
export async function createRoleBinding(instanceId: string, binding: Omit<RoleBinding, 'id'>) { return apiClient.post(`/application-instances/${encodeURIComponent(instanceId)}/role-bindings`, binding) }
export async function revokeRoleBinding(instanceId: string, bindingId: string) { return apiClient.delete(`/application-instances/${encodeURIComponent(instanceId)}/role-bindings/${encodeURIComponent(bindingId)}`, { data: {} }) }

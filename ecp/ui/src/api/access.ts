import { apiClient } from './client'

export type Resource = { id: string; name: string; type: string }
export type ResourceSearch = { reason?: 'resource_not_visible'; resources: Resource[] }
export type RoleBinding = { id: string; principal_id: string; role: string; resource?: Resource }

export async function searchResources(instanceId: string, query: string) {
  return (await apiClient.get<ResourceSearch>(`/application-instances/${encodeURIComponent(instanceId)}/resources`, { params: { query } })).data
}
export async function listRoleBindings(instanceId: string) { return (await apiClient.get<{ items: RoleBinding[] }>(`/application-instances/${encodeURIComponent(instanceId)}/role-bindings`)).data.items }
export async function createRoleBinding(instanceId: string, binding: Omit<RoleBinding, 'id'>) { return apiClient.post(`/application-instances/${encodeURIComponent(instanceId)}/role-bindings`, binding) }

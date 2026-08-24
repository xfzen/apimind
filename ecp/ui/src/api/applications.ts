import axios from 'axios'

import { apiClient } from './client'

export type Manifest = { resource_types: string[]; roles: string[]; actions: string[]; capabilities: string[]; version: number }
export type Application = { id: string; name: string; manifest?: Manifest; instances?: Array<{ id: string; name: string; state: string }> }
export type ApplicationInstance = { id: string; application_id: string; name: string; base_url: string; state: string; manifest?: Manifest }

type ApplicationWire = { id: string; name: string }
type InstanceWire = { id: string; application_id: string; instance_key: string; canonical_url: string; status: string }
type ManifestWire = { body: string; version: number }
type ManifestRole = { id: string; resource_type: string; actions: string[] }
type ManifestBody = { capabilities?: string[]; resources?: Array<{ type: string; actions: string[] }>; roles?: ManifestRole[] }
function parseManifest(value: ManifestWire): Manifest { const body = JSON.parse(value.body) as ManifestBody; return { resource_types: (body.resources ?? []).map((item) => item.type), roles: (body.roles ?? []).map((role) => role.id), actions: [...new Set((body.resources ?? []).flatMap((item) => item.actions))], capabilities: body.capabilities ?? [], version: value.version } }
export async function listApplications() { const [applications, instances] = await Promise.all([apiClient.get<{ applications: ApplicationWire[] }>('/applications'), apiClient.get<{ instances: InstanceWire[] }>('/instances')]); return applications.data.applications.map((application) => ({ ...application, instances: instances.data.instances.filter((instance) => instance.application_id === application.id).map((instance) => ({ id: instance.id, name: instance.instance_key, state: instance.status })) })) }
export async function listInstances(applicationId?: string) { const response = await apiClient.get<{ instances: InstanceWire[] }>('/instances', { params: applicationId ? { application_id: applicationId } : undefined }); return response.data.instances }
export async function getInstance(id: string) {
  const value = (await apiClient.get<InstanceWire>(`/instances/${encodeURIComponent(id)}`)).data
  let manifest: Manifest | undefined
  try {
    manifest = parseManifest((await apiClient.get<ManifestWire>(`/applications/${encodeURIComponent(value.application_id)}/manifest`)).data)
  } catch (error) {
    if (!isMissingResource(error, 'manifest_not_found')) throw error
  }
  return { id: value.id, application_id: value.application_id, name: value.instance_key, base_url: value.canonical_url, state: value.status, manifest }
}

function isMissingResource(error: unknown, reason: string) {
  if (!axios.isAxiosError(error) || ![400, 404].includes(error.response?.status ?? 0)) return false
  return JSON.stringify(error.response?.data ?? '').includes(reason)
}

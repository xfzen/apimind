import { apiClient } from './client'

export type BackupStatus = {
  state: 'verified' | 'failed' | 'in_progress' | 'completed' | 'never_run'
  backup_id?: string
  manifest_hash?: string
  failure_reason?: string
  started_at?: number
  completed_at?: number
  verified_at?: number
}

export async function getBackupStatus() {
  return (await apiClient.get<BackupStatus>('/operations/backup/status')).data
}

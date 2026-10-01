import { gql, gqlUpload } from './client'

export interface BackupFlags {
  includeManga: boolean
  includeCategories: boolean
  includeChapters: boolean
  includeTracking: boolean
  includeHistory: boolean
  includeClientData: boolean
  includeServerSettings: boolean
}

export const DEFAULT_BACKUP_FLAGS: BackupFlags = {
  includeManga: true,
  includeCategories: true,
  includeChapters: true,
  includeTracking: true,
  includeHistory: true,
  includeClientData: true, // global meta = setelan mihonweb_* ikut ter-backup
  includeServerSettings: true,
}

/** Mengembalikan URL unduhan relatif, mis. `/api/graphql/files/backup/<nama>.tachibk`. */
export async function createBackup(flags: BackupFlags): Promise<string> {
  const data = await gql<{ createBackup: { url: string } }>(
    `mutation CreateBackup($input: CreateBackupInput!) { createBackup(input: $input) { url } }`,
    { input: { flags } },
  )
  return data.createBackup.url
}

export interface BackupValidation {
  missingSources: Array<{ id: string; name: string }>
  missingTrackers: Array<{ name: string }>
}

export async function validateBackup(file: File): Promise<BackupValidation> {
  const data = await gqlUpload<{ validateBackup: BackupValidation }>(
    `query ValidateBackup($backup: Upload!) {
      validateBackup(input: { backup: $backup }) {
        missingSources { id name }
        missingTrackers { name }
      }
    }`,
    {},
    'backup',
    file,
  )
  return data.validateBackup
}

export type RestoreState =
  | 'IDLE'
  | 'SUCCESS'
  | 'FAILURE'
  | 'RESTORING_CATEGORIES'
  | 'RESTORING_MANGA'
  | 'RESTORING_META'
  | 'RESTORING_SETTINGS'

export interface RestoreStatus {
  state: RestoreState
  mangaProgress: number
  totalManga: number
}

export async function restoreBackup(file: File, flags: BackupFlags): Promise<string> {
  const data = await gqlUpload<{ restoreBackup: { id: string } }>(
    `mutation RestoreBackup($backup: Upload!, $flags: PartialBackupFlagsInput) {
      restoreBackup(input: { backup: $backup, flags: $flags }) { id }
    }`,
    { flags },
    'backup',
    file,
  )
  return data.restoreBackup.id
}

export async function fetchRestoreStatus(id: string): Promise<RestoreStatus | null> {
  const data = await gql<{ restoreStatus: RestoreStatus | null }>(
    `query RestoreStatus($id: String!) { restoreStatus(id: $id) { state mangaProgress totalManga } }`,
    { id },
  )
  return data.restoreStatus
}

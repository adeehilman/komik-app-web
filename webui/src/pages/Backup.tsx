import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createBackup, DEFAULT_BACKUP_FLAGS, fetchRestoreStatus, restoreBackup, validateBackup } from '../api/backup'
import type { BackupFlags, BackupValidation, RestoreStatus } from '../api/backup'
import { TopBar } from '../components/TopBar'
import { Dialog } from '../components/Sheet'

const FLAG_LABELS: Array<[keyof BackupFlags, string]> = [
  ['includeManga', 'Manga di library'],
  ['includeCategories', 'Kategori'],
  ['includeChapters', 'Chapter (status baca)'],
  ['includeTracking', 'Tracking'],
  ['includeHistory', 'Riwayat'],
  ['includeClientData', 'Setelan WebUI (meta)'],
  ['includeServerSettings', 'Setelan server'],
]

const STATE_LABEL: Record<string, string> = {
  IDLE: 'Menunggu…',
  RESTORING_CATEGORIES: 'Memulihkan kategori…',
  RESTORING_MANGA: 'Memulihkan manga…',
  RESTORING_META: 'Memulihkan setelan…',
  RESTORING_SETTINGS: 'Memulihkan setelan server…',
  SUCCESS: 'Restore selesai',
  FAILURE: 'Restore gagal',
}

function FlagList({ flags, onChange }: { flags: BackupFlags; onChange: (f: BackupFlags) => void }) {
  return (
    <>
      {FLAG_LABELS.map(([key, label]) => (
        <label key={key} className="list-item">
          <input type="checkbox" checked={flags[key]} onChange={(e) => onChange({ ...flags, [key]: e.target.checked })} />
          <span className="list-item-title">{label}</span>
        </label>
      ))}
    </>
  )
}

export function BackupPage() {
  const queryClient = useQueryClient()
  const [flags, setFlags] = useState<BackupFlags>(DEFAULT_BACKUP_FLAGS)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)

  const [file, setFile] = useState<File | null>(null)
  const [validation, setValidation] = useState<BackupValidation | null>(null)
  const [restoreFlags, setRestoreFlags] = useState<BackupFlags>(DEFAULT_BACKUP_FLAGS)
  const [restoreId, setRestoreId] = useState<string | null>(null)
  const [status, setStatus] = useState<RestoreStatus | null>(null)
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const [working, setWorking] = useState(false)

  const create = async () => {
    setCreating(true)
    setCreateError(null)
    setDownloadUrl(null)
    try {
      const url = await createBackup(flags)
      setDownloadUrl(url)
      // Unduh langsung; di iPhone Safari menampilkan dialog simpan ke Files.
      const a = document.createElement('a')
      a.href = url
      a.download = url.split('/').pop() ?? 'backup.tachibk'
      document.body.appendChild(a)
      a.click()
      a.remove()
    } catch (e) {
      setCreateError((e as Error).message)
    } finally {
      setCreating(false)
    }
  }

  const pick = async (f: File | null) => {
    setFile(f)
    setValidation(null)
    setRestoreError(null)
    setStatus(null)
    setRestoreId(null)
    if (!f) return
    setWorking(true)
    try {
      setValidation(await validateBackup(f))
    } catch (e) {
      setRestoreError((e as Error).message)
      setFile(null)
    } finally {
      setWorking(false)
    }
  }

  const restore = async () => {
    if (!file) return
    setWorking(true)
    setRestoreError(null)
    try {
      setRestoreId(await restoreBackup(file, restoreFlags))
    } catch (e) {
      setRestoreError((e as Error).message)
    } finally {
      setWorking(false)
    }
  }

  // Polling status tiap 1 detik sampai SUCCESS / FAILURE (.agents/features/backup-ui.md).
  useEffect(() => {
    if (!restoreId) return
    let stopped = false
    const tick = async () => {
      try {
        const s = await fetchRestoreStatus(restoreId)
        if (stopped) return
        setStatus(s)
        if (s?.state === 'SUCCESS') {
          // Semua data bisa berubah: library, chapter, dan setelan mihonweb_*.
          await queryClient.invalidateQueries()
          return
        }
        if (s?.state === 'FAILURE') return
      } catch (e) {
        if (!stopped) setRestoreError((e as Error).message)
        return
      }
      if (!stopped) window.setTimeout(tick, 1000)
    }
    tick()
    return () => {
      stopped = true
    }
  }, [restoreId, queryClient])

  const done = status?.state === 'SUCCESS' || status?.state === 'FAILURE'
  const progress = status && status.totalManga > 0 ? ` (${status.mangaProgress}/${status.totalManga})` : ''

  return (
    <div>
      <TopBar back title="Backup & restore" />

      <div className="section-title">Buat backup</div>
      <FlagList flags={flags} onChange={setFlags} />
      <div className="load-more">
        <button type="button" className="btn" disabled={creating} onClick={create}>
          {creating ? 'Membuat…' : 'Buat & unduh backup'}
        </button>
      </div>
      {createError && <div className="error-text">{createError}</div>}
      {downloadUrl && (
        <p className="list-item-subtitle backup-note">
          Kalau unduhan tidak mulai, <a href={downloadUrl} download className="link">ketuk di sini</a>.
        </p>
      )}

      <div className="section-title">Restore</div>
      <label className="list-item">
        <span className="list-item-text">
          <span className="list-item-title">{file ? file.name : 'Pilih file .tachibk'}</span>
          <span className="list-item-subtitle">File dicek dulu sebelum dipulihkan</span>
        </span>
        <input
          type="file"
          className="file-input"
          onChange={(e) => pick(e.target.files?.[0] ?? null)}
          disabled={working || (restoreId !== null && !done)}
        />
      </label>
      {working && !restoreId && <div className="spinner" />}
      {restoreError && <div className="error-text">{restoreError}</div>}

      {status && (
        <div className="backup-status">
          <div className={`progress-bar ${done ? '' : 'indeterminate'}`}>
            <div className="progress-bar-fill" style={done ? { width: '100%' } : undefined} />
          </div>
          <p className={status.state === 'FAILURE' ? 'error-text' : 'list-item-subtitle backup-note'}>
            {STATE_LABEL[status.state] ?? status.state}
            {progress}
          </p>
        </div>
      )}

      <Dialog
        open={validation !== null && restoreId === null}
        title="Restore backup?"
        onClose={() => setValidation(null)}
        actions={
          <>
            <button type="button" className="btn btn-text" onClick={() => pick(null)}>
              Batal
            </button>
            <button type="button" className="btn btn-text" disabled={working} onClick={restore}>
              Restore
            </button>
          </>
        }
      >
        <p>{file?.name}</p>
        {validation && validation.missingSources.length > 0 && (
          <>
            <p className="backup-warning">Source belum terpasang (manga-nya tetap dipulihkan, tapi tidak bisa dibuka):</p>
            <ul>
              {validation.missingSources.map((s) => (
                <li key={s.id}>{s.name}</li>
              ))}
            </ul>
          </>
        )}
        {validation && validation.missingTrackers.length > 0 && (
          <>
            <p className="backup-warning">Tracker belum login:</p>
            <ul>
              {validation.missingTrackers.map((t) => (
                <li key={t.name}>{t.name}</li>
              ))}
            </ul>
          </>
        )}
        <FlagList flags={restoreFlags} onChange={setRestoreFlags} />
      </Dialog>
    </div>
  )
}

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { TopBar } from '../components/TopBar'
import { serverPath } from '../api/base'
import { COVER_FALLBACK } from '../coverFallback'
import { setMangasInLibrary } from '../api/library'
import type { MangaItem } from '../api/library'
import { fetchMigrationData, groupDuplicates } from '../api/migration'
import type { DuplicateGroup } from '../api/migration'
import './Migration.css'

/* Cover kecil dengan tahap yang sama seperti MangaCard: orig -> fallback -> hilang. */
function Thumb({ manga }: { manga: MangaItem }) {
  const fallback = COVER_FALLBACK[manga.id]
  const [stage, setStage] = useState<'orig' | 'fallback' | 'hidden'>('orig')
  const origSrc = manga.thumbnailUrl ? serverPath(manga.thumbnailUrl) : undefined
  const fallbackSrc = fallback ? serverPath(fallback) : undefined
  const src = stage === 'orig' ? (origSrc ?? fallbackSrc) : stage === 'fallback' ? fallbackSrc : undefined
  if (!src) return <div className="migration-thumb migration-thumb-empty" />
  return (
    <img
      className="migration-thumb"
      src={src}
      alt=""
      loading="lazy"
      onError={() => setStage(stage === 'orig' && origSrc && fallbackSrc ? 'fallback' : 'hidden')}
    />
  )
}

function EntryRow({
  manga,
  actionLabel,
  busy,
  onAction,
}: {
  manga: MangaItem
  actionLabel: string
  busy: boolean
  onAction: () => void
}) {
  const source = manga.source?.displayName ?? 'Sumber tidak dikenal'
  return (
    <div className="migration-row">
      <Thumb manga={manga} />
      <div className="migration-row-text">
        <Link to={`/manga/${manga.id}`} className="migration-row-title">
          {manga.title}
        </Link>
        <span className="migration-row-meta">
          {source} • {manga.chapters.totalCount} chapter • {manga.unreadCount} belum dibaca
        </span>
      </div>
      <button className="migration-btn" disabled={busy} onClick={onAction}>
        {busy ? '…' : actionLabel}
      </button>
    </div>
  )
}

function GroupBlock({
  group,
  actionLabel,
  entries,
  busyId,
  onAction,
}: {
  group: DuplicateGroup
  actionLabel: string
  entries: MangaItem[]
  busyId: number | null
  onAction: (id: number) => void
}) {
  return (
    <div className="migration-group">
      <div className="migration-group-title">{group.title}</div>
      {entries.map((m) => (
        <EntryRow
          key={m.id}
          manga={m}
          actionLabel={actionLabel}
          busy={busyId === m.id}
          onAction={() => onAction(m.id)}
        />
      ))}
    </div>
  )
}

export function MigrationPage() {
  const queryClient = useQueryClient()
  const [busyId, setBusyId] = useState<number | null>(null)
  const [error, setError] = useState('')

  const { data, isLoading, error: loadError } = useQuery({
    queryKey: ['migration'],
    queryFn: fetchMigrationData,
  })

  const toggle = useMutation({
    mutationFn: ({ id, inLibrary }: { id: number; inLibrary: boolean }) => setMangasInLibrary([id], inLibrary),
    onMutate: ({ id }) => {
      setBusyId(id)
      setError('')
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Gagal mengubah entri'),
    onSettled: () => {
      setBusyId(null)
      void queryClient.invalidateQueries({ queryKey: ['migration'] })
      void queryClient.invalidateQueries({ queryKey: ['library'] })
      void queryClient.invalidateQueries({ queryKey: ['updates'] })
      void queryClient.invalidateQueries({ queryKey: ['newChapterCount'] })
    },
  })

  const groups = data ? groupDuplicates(data) : []
  const dupGroups = groups.filter((g) => g.library.length >= 2)
  const hiddenGroups = groups.filter((g) => g.hidden.length >= 1)

  return (
    <div className="migration-page">
      <TopBar back title="Migrasi" subtitle="Kelola judul ganda dari beberapa sumber" />
      <p className="migration-note">
        Judul yang sama dari sumber berbeda muncul berkelompok. <b>Sembunyikan</b> mengeluarkan entri dari Library,
        tab Updates, dan update otomatis — progres baca tetap tersimpan dan bisa dikembalikan dari daftar bawah.
      </p>
      {isLoading && <div className="spinner" />}
      {loadError && <div className="error-text">{(loadError as Error).message}</div>}
      {error && <div className="error-text">{error}</div>}
      {data && (
        <>
          <div className="section-title">Judul ganda ({dupGroups.length})</div>
          {dupGroups.length === 0 && <p className="migration-empty">Tidak ada judul ganda di library.</p>}
          {dupGroups.map((g) => (
            <GroupBlock
              key={g.key}
              group={g}
              entries={g.library}
              actionLabel="Sembunyikan"
              busyId={busyId}
              onAction={(id) => toggle.mutate({ id, inLibrary: false })}
            />
          ))}
          <div className="section-title">Disembunyikan ({hiddenGroups.reduce((n, g) => n + g.hidden.length, 0)})</div>
          {hiddenGroups.length === 0 && <p className="migration-empty">Tidak ada entri yang disembunyikan.</p>}
          {hiddenGroups.map((g) => (
            <GroupBlock
              key={g.key}
              group={g}
              entries={g.hidden}
              actionLabel="Kembalikan"
              busyId={busyId}
              onAction={(id) => toggle.mutate({ id, inLibrary: true })}
            />
          ))}
        </>
      )}
    </div>
  )
}

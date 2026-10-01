import { useEffect } from 'react'
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchLastUpdateTimestamp, fetchRecentChapters, UPDATES_PAGE_SIZE } from '../api/updates'
import { enqueueDownloads } from '../api/chapter'
import { toNumber } from '../api/client'
import { TopBar } from '../components/TopBar'
import { Icon } from '../components/Icon'
import { EntryRow, groupByDay } from '../components/EntryRow'
import { LibraryUpdateBar, useLibraryUpdate } from '../components/LibraryUpdate'
import { PullIndicator, usePullToRefresh } from '../components/usePullToRefresh'
import { useSetting } from '../settings/useSetting'

function timeAgo(ms: number): string {
  if (!ms) return 'belum pernah'
  const minutes = Math.round((Date.now() - ms) / 60_000)
  if (minutes < 1) return 'baru saja'
  if (minutes < 60) return `${minutes} menit lalu`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} jam lalu`
  return `${Math.round(hours / 24)} hari lalu`
}

export function UpdatesPage() {
  const queryClient = useQueryClient()
  const update = useLibraryUpdate()
  const [, setLastSeen] = useSetting('mihonweb_updates_last_seen')

  const updates = useInfiniteQuery({
    queryKey: ['updates'],
    queryFn: ({ pageParam }) => fetchRecentChapters(pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (last.hasNextPage ? pages.length * UPDATES_PAGE_SIZE : undefined),
  })
  const lastUpdate = useQuery({ queryKey: ['lastUpdateTimestamp'], queryFn: fetchLastUpdateTimestamp })

  // Membuka tab Updates = semua chapter baru sudah "dilihat" → badge di bottom nav hilang.
  useEffect(() => {
    setLastSeen(Math.floor(Date.now() / 1000)).then(() =>
      queryClient.invalidateQueries({ queryKey: ['newChapterCount'] }),
    )
  }, [setLastSeen, queryClient])

  useEffect(() => {
    if (!update.status?.isRunning) queryClient.invalidateQueries({ queryKey: ['lastUpdateTimestamp'] })
  }, [update.status?.isRunning, queryClient])

  const pull = usePullToRefresh(() => update.start(), !update.status?.isRunning)
  const items = updates.data?.pages.flatMap((p) => p.items) ?? []
  // fetchedAt dalam detik (terverifikasi: 1790753975).
  const groups = groupByDay(items, (c) => toNumber(c.fetchedAt) * 1000)

  return (
    <div>
      <TopBar
        title="Updates"
        subtitle={`Terakhir diperbarui: ${timeAgo(toNumber(lastUpdate.data))}`}
        actions={
          <button
            type="button"
            className="icon-btn"
            aria-label="Update library"
            disabled={update.status?.isRunning}
            onClick={() => update.start()}
          >
            <Icon name="refresh" />
          </button>
        }
        below={<LibraryUpdateBar status={update.status} onStop={update.stop} />}
      />
      <PullIndicator distance={pull} />

      {updates.isLoading && <div className="spinner" />}
      {updates.error && <div className="error-text">{(updates.error as Error).message}</div>}
      {updates.data && items.length === 0 && (
        <div className="empty-state">
          <span className="empty-face">(･o･;)</span>
          <span>Belum ada update. Tarik ke bawah untuk memperbarui library.</span>
        </div>
      )}

      {groups.map(([label, chapters]) => (
        <section key={label}>
          <div className="section-title">{label}</div>
          {chapters.map((c) => (
            <EntryRow
              key={c.id}
              mangaId={c.mangaId}
              thumbnailUrl={c.manga.thumbnailUrl}
              title={c.manga.title}
              subtitle={
                <>
                  {c.name}
                  {!c.isRead && c.lastPageRead > 0 && ` • Halaman ${c.lastPageRead + 1}`}
                </>
              }
              to={`/reader/${c.id}`}
              dimmed={c.isRead}
              action={
                <button
                  type="button"
                  className={`icon-btn ${c.isDownloaded ? 'active' : ''}`}
                  aria-label={c.isDownloaded ? 'Sudah diunduh' : 'Unduh'}
                  disabled={c.isDownloaded}
                  onClick={() => enqueueDownloads([c.id]).then(() => queryClient.invalidateQueries({ queryKey: ['updates'] }))}
                >
                  <Icon name={c.isDownloaded ? 'downloaded' : 'download'} size={22} />
                </button>
              }
            />
          ))}
        </section>
      ))}

      {updates.hasNextPage && (
        <div className="load-more">
          <button
            type="button"
            className="btn btn-tonal"
            disabled={updates.isFetchingNextPage}
            onClick={() => updates.fetchNextPage()}
          >
            {updates.isFetchingNextPage ? 'Memuat…' : 'Muat lebih banyak'}
          </button>
        </div>
      )}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchLastUpdateTimestamp, fetchRecentChapters, UPDATES_PAGE_SIZE } from '../api/updates'
import type { UpdateEntry } from '../api/updates'
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

/*
 * Updates anti-spam (2026-10-29):
 * - Chapter baru dikelompokkan per judul, bukan satu baris per chapter. Judul yang
 *   sekali update dapat 33 chapter (kasus Return Of The Apocalypse-Class, 29 Okt)
 *   jadi cuma 1 baris: "Chapter 62 – Chapter 94 • 33 chapter baru".
 * - Lalu dibagi 2 section menurut total chapter belum dibaca judul itu:
 *   "Yang kamu ikuti" = unreadCount <= 10 (masih nyaris kejar tayang, chapter baru
 *   itu memang lanjutan bacaan). "Tertinggal" = unreadCount > 10 (sudah lama
 *   ditinggalkan / belum pernah dimulai / duplikat sumber) — dilipat defaultnya,
 *   tetap bisa dibuka, tidak ada yang dihapus atau disembunyikan permanen.
 * Ambang 10: dari data live 29 Okt, 52 judul library punya unread 1–10, sementara
 * 92 judul punya unread 31+. Judul 11–30 ikut Tertinggal, tapi cuma 1 baris per
 * judul dan tinggal 1 ketukan untuk dibuka.
 */
const FOLLOWING_UNREAD_LIMIT = 10

interface MangaUpdateGroup {
  mangaId: number
  title: string
  thumbnailUrl: string | null
  unreadCount: number
  chapters: UpdateEntry[]
}

/** Kelompokkan chapter satu hari per judul, urut sourceOrder naik di tiap judul. */
function groupByManga(chapters: UpdateEntry[]): MangaUpdateGroup[] {
  const groups: MangaUpdateGroup[] = []
  for (const c of chapters) {
    const last = groups[groups.length - 1]
    // items sudah urut FETCHED_AT DESC; judul yang sama biasanya berurutan, tapi
    // jangan andalkan itu — cari grup yang sudah ada.
    const existing = groups.find((g) => g.mangaId === c.mangaId)
    if (existing) existing.chapters.push(c)
    else if (last && last.mangaId === c.mangaId) last.chapters.push(c)
    else
      groups.push({
        mangaId: c.mangaId,
        title: c.manga.title,
        thumbnailUrl: c.manga.thumbnailUrl,
        unreadCount: c.manga.unreadCount,
        chapters: [c],
      })
  }
  for (const g of groups) g.chapters.sort((a, b) => a.sourceOrder - b.sourceOrder)
  return groups
}

export function UpdatesPage() {
  const queryClient = useQueryClient()
  const update = useLibraryUpdate()
  const [, setLastSeen] = useSetting('mihonweb_updates_last_seen')
  const [showBehind, setShowBehind] = useState(false)

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
  const dayGroups = groupByDay(items, (c) => toNumber(c.fetchedAt) * 1000)

  type DayGroups = Array<[string, MangaUpdateGroup[]]>
  const splitDays = (keepFollowing: boolean): DayGroups =>
    dayGroups
      .map(
        ([label, chapters]) =>
          [
            label,
            groupByManga(chapters).filter((g) =>
              keepFollowing ? g.unreadCount <= FOLLOWING_UNREAD_LIMIT : g.unreadCount > FOLLOWING_UNREAD_LIMIT,
            ),
          ] as [string, MangaUpdateGroup[]],
      )
      .filter(([, groups]) => groups.length > 0)
  const followingDays = splitDays(true)
  const behindDays = splitDays(false)
  const behindTitleCount = behindDays.reduce((n, [, groups]) => n + groups.length, 0)
  const behindChapterCount = behindDays.reduce(
    (n, [, groups]) => n + groups.reduce((m, g) => m + g.chapters.length, 0),
    0,
  )

  const renderGroup = (g: MangaUpdateGroup) => {
    const first = g.chapters[0]
    const last = g.chapters[g.chapters.length - 1]
    // Ketuk baris = baca chapter baru paling awal yang belum dibaca (bukan yang
    // terbaru), supaya urutan baca tidak lompat.
    const target = g.chapters.find((c) => !c.isRead) ?? first
    const allRead = g.chapters.every((c) => c.isRead)
    const allDownloaded = g.chapters.every((c) => c.isDownloaded)
    return (
      <EntryRow
        key={g.mangaId}
        mangaId={g.mangaId}
        thumbnailUrl={g.thumbnailUrl}
        title={g.title}
        subtitle={
          g.chapters.length === 1 ? (
            <>
              {target.name}
              {!target.isRead && target.lastPageRead > 0 && ` • Halaman ${target.lastPageRead + 1}`}
            </>
          ) : (
            `${first.name} – ${last.name} • ${g.chapters.length} chapter baru`
          )
        }
        to={`/reader/${target.id}`}
        dimmed={allRead}
        action={
          <button
            type="button"
            className={`icon-btn ${allDownloaded ? 'active' : ''}`}
            aria-label={allDownloaded ? 'Sudah diunduh' : 'Unduh semua chapter baru'}
            disabled={allDownloaded}
            onClick={() =>
              enqueueDownloads(g.chapters.map((c) => c.id)).then(() =>
                queryClient.invalidateQueries({ queryKey: ['updates'] }),
              )
            }
          >
            <Icon name={allDownloaded ? 'downloaded' : 'download'} size={22} />
          </button>
        }
      />
    )
  }

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

      {updates.data && items.length > 0 && followingDays.length === 0 && (
        <div className="empty-state">
          <span>Tidak ada update dari judul yang kamu ikuti.</span>
          <span>Judul yang tertinggal ada di bawah, dilipat supaya tidak menuh-menuhin daftar.</span>
        </div>
      )}

      {followingDays.length > 0 && <div className="section-title">Yang kamu ikuti</div>}
      {followingDays.map(([label, groups]) => (
        <section key={`ikut-${label}`}>
          <div className="section-title">{label}</div>
          {groups.map(renderGroup)}
        </section>
      ))}

      {behindTitleCount > 0 && (
        <>
          <button type="button" className="list-item" onClick={() => setShowBehind((v) => !v)}>
            <span className="list-item-text">
              <span className="list-item-title">Tertinggal</span>
              <span className="list-item-subtitle">
                {behindTitleCount} judul • {behindChapterCount} chapter baru •{' '}
                {showBehind ? 'ketuk untuk melipat' : 'ketuk untuk menampilkan'}
              </span>
            </span>
            <span className="list-item-icon">{showBehind ? '▴' : '▾'}</span>
          </button>
          {showBehind &&
            behindDays.map(([label, groups]) => (
              <section key={`tertinggal-${label}`}>
                <div className="section-title">{label}</div>
                {groups.map(renderGroup)}
              </section>
            ))}
        </>
      )}

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

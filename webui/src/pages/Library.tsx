import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchLibrary, setMangasCategory, setMangasInLibrary } from '../api/library'
import type { CategoryItem, MangaItem } from '../api/library'
import { enqueueDownloads, fetchChapterIdsForMangas, updateChapters } from '../api/chapter'
import { toNumber } from '../api/client'
import { TopBar } from '../components/TopBar'
import { Icon } from '../components/Icon'
import { MangaCard, MangaGrid } from '../components/MangaCard'
import { LibrarySheet } from '../components/LibrarySheet'
import { Dialog } from '../components/Sheet'
import { LibraryUpdateBar, useLibraryUpdate } from '../components/LibraryUpdate'
import { PullIndicator, usePullToRefresh } from '../components/usePullToRefresh'
import { useSetting } from '../settings/useSetting'
import type { SettingsSchema } from '../settings/schema'
import './Library.css'

type TriState = 'any' | 'only' | 'exclude'

function passes(state: TriState, value: boolean): boolean {
  if (state === 'only') return value
  if (state === 'exclude') return !value
  return true
}

/** Hash deterministik untuk sort "random" yang stabil sampai seed diganti. */
function seededRank(id: number, seed: number): number {
  let x = (id * 2654435761 + seed * 40503) >>> 0
  x ^= x >>> 15
  x = Math.imul(x, 2246822507) >>> 0
  x ^= x >>> 13
  return x
}

function sortValue(m: MangaItem, mode: SettingsSchema['mihonweb_library_sort'], seed: number): number {
  switch (mode) {
    case 'total_chapters':
      return m.chapters.totalCount
    case 'last_read':
      return toNumber(m.latestReadChapter?.lastReadAt)
    case 'last_update':
      return toNumber(m.latestFetchedChapter?.fetchedAt)
    case 'unread':
      return m.unreadCount
    case 'latest_chapter':
      return toNumber(m.latestUploadedChapter?.uploadDate)
    case 'date_added':
      return toNumber(m.inLibraryAt)
    case 'random':
      return seededRank(m.id, seed)
    default:
      return 0
  }
}

/** Kategori Default (id 0) = manga tanpa kategori. */
function inCategory(m: MangaItem, categoryId: number): boolean {
  const ids = m.categories.nodes
  return categoryId === 0 ? ids.length === 0 : ids.some((c) => c.id === categoryId)
}

export function LibraryPage() {
  const queryClient = useQueryClient()
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['library'], queryFn: fetchLibrary })
  const update = useLibraryUpdate()

  const [display] = useSetting('mihonweb_library_display')
  const [colsPortrait] = useSetting('mihonweb_library_columns_portrait')
  const [colsLandscape] = useSetting('mihonweb_library_columns_landscape')
  const [badgeUnread] = useSetting('mihonweb_library_badge_unread')
  const [badgeDownloaded] = useSetting('mihonweb_library_badge_downloaded')
  const [badgeLang] = useSetting('mihonweb_library_badge_language')
  const [continueButton] = useSetting('mihonweb_library_continue_button')
  const [showTabs] = useSetting('mihonweb_library_category_tabs')
  const [showCount] = useSetting('mihonweb_library_category_count')
  const [lastCategory, setLastCategory] = useSetting('mihonweb_library_last_category')
  const [fDownloaded] = useSetting('mihonweb_library_filter_downloaded')
  const [fUnread] = useSetting('mihonweb_library_filter_unread')
  const [fStarted] = useSetting('mihonweb_library_filter_started')
  const [fBookmarked] = useSetting('mihonweb_library_filter_bookmarked')
  const [fCompleted] = useSetting('mihonweb_library_filter_completed')
  const [sort] = useSetting('mihonweb_library_sort')
  const [sortDir] = useSetting('mihonweb_library_sort_dir')
  const [seed] = useSetting('mihonweb_library_random_seed')

  const [searching, setSearching] = useState(false)
  const [search, setSearch] = useState('')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [selected, setSelected] = useState<number[]>([])
  const [dialog, setDialog] = useState<'category' | 'remove' | null>(null)
  const [busy, setBusy] = useState(false)

  const isLandscape = typeof window !== 'undefined' && window.matchMedia('(orientation: landscape)').matches
  const columns = isLandscape ? colsLandscape : colsPortrait
  const mangas = data?.mangas
  const selectionMode = selected.length > 0

  // Tab kategori: Default hanya tampil kalau berisi atau satu-satunya kategori (seperti Mihon).
  const categories: CategoryItem[] = useMemo(() => {
    if (!data) return []
    const nonDefault = data.categories.filter((c) => c.id !== 0)
    const defaultHasItems = data.mangas.some((m) => m.categories.nodes.length === 0)
    const def = data.categories.find((c) => c.id === 0)
    return [...(def && (defaultHasItems || nonDefault.length === 0) ? [def] : []), ...nonDefault]
  }, [data])

  const tabsVisible = showTabs && categories.length > 1
  const activeCategory = categories.some((c) => c.id === lastCategory) ? lastCategory : (categories[0]?.id ?? 0)

  const visible = useMemo(() => {
    if (!mangas) return []
    const q = search.trim().toLowerCase()
    const list = mangas.filter(
      (m) =>
        (!tabsVisible || inCategory(m, activeCategory)) &&
        (!q || m.title.toLowerCase().includes(q)) &&
        passes(fDownloaded, m.downloadCount > 0) &&
        passes(fUnread, m.unreadCount > 0) &&
        passes(fStarted, m.latestReadChapter !== null) &&
        passes(fBookmarked, m.bookmarkCount > 0) &&
        passes(fCompleted, m.status === 'COMPLETED'),
    )
    const dir = sortDir === 'asc' ? 1 : -1
    return list.sort((a, b) => {
      if (sort === 'alpha') return dir * a.title.localeCompare(b.title)
      const diff = sortValue(a, sort, seed) - sortValue(b, sort, seed)
      return diff !== 0 ? dir * diff : a.title.localeCompare(b.title)
    })
  }, [mangas, search, tabsVisible, activeCategory, fDownloaded, fUnread, fStarted, fBookmarked, fCompleted, sort, sortDir, seed])

  const categoryCount = (id: number) => mangas?.filter((m) => inCategory(m, id)).length ?? 0

  const updateCurrent = () => {
    setMenuOpen(false)
    update.start(tabsVisible ? [activeCategory] : undefined)
  }

  const pull = usePullToRefresh(updateCurrent, !selectionMode && !update.status?.isRunning)

  const toggle = (id: number) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  /** Jalankan aksi pilih-banyak lalu keluar dari mode pilih. */
  const runBulk = async (action: () => Promise<void>) => {
    setBusy(true)
    try {
      await action()
      setSelected([])
      setDialog(null)
      await queryClient.invalidateQueries({ queryKey: ['library'] })
    } catch (e) {
      window.alert(`Gagal: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  const markRead = (isRead: boolean) =>
    runBulk(async () => updateChapters(await fetchChapterIdsForMangas(selected), { isRead }))
  const downloadUnread = () =>
    runBulk(async () =>
      enqueueDownloads(await fetchChapterIdsForMangas(selected, { unreadOnly: true, notDownloadedOnly: true })),
    )

  const topBar = selectionMode ? (
    <TopBar
      title={`${selected.length} dipilih`}
      actions={
        <>
          <button
            type="button"
            className="icon-btn"
            aria-label="Pilih semua"
            onClick={() => setSelected(visible.map((m) => m.id))}
          >
            <Icon name="selectAll" />
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label="Balik pilihan"
            onClick={() => setSelected(visible.filter((m) => !selected.includes(m.id)).map((m) => m.id))}
          >
            <Icon name="flip" />
          </button>
          <button type="button" className="icon-btn" aria-label="Batal" onClick={() => setSelected([])}>
            <Icon name="close" />
          </button>
        </>
      }
    />
  ) : (
    <TopBar
      title={
        <>
          Library
          {showCount && mangas && <span className="tab-count">{mangas.length}</span>}
        </>
      }
      actions={
        <>
          <button type="button" className="icon-btn" aria-label="Cari" onClick={() => setSearching(true)}>
            <Icon name="search" />
          </button>
          <button type="button" className="icon-btn" aria-label="Filter" onClick={() => setSheetOpen(true)}>
            <Icon name="filter" />
          </button>
          <button type="button" className="icon-btn" aria-label="Menu" onClick={() => setMenuOpen((v) => !v)}>
            <Icon name="more" />
          </button>
        </>
      }
      below={
        <>
          {tabsVisible && (
            <div className="tabs">
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`tab ${c.id === activeCategory ? 'active' : ''}`}
                  onClick={() => setLastCategory(c.id)}
                >
                  {c.name}
                  {showCount && <span className="tab-count">{categoryCount(c.id)}</span>}
                </button>
              ))}
            </div>
          )}
          <LibraryUpdateBar status={update.status} onStop={update.stop} />
        </>
      }
    >
      {searching ? (
        <>
          <input
            className="top-bar-search"
            autoFocus
            placeholder="Cari di library…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            type="button"
            className="icon-btn"
            aria-label="Tutup pencarian"
            onClick={() => {
              setSearching(false)
              setSearch('')
            }}
          >
            <Icon name="close" />
          </button>
        </>
      ) : undefined}
    </TopBar>
  )

  return (
    <div className="library-page">
      {topBar}
      {menuOpen && (
        <>
          <div className="menu-scrim" onClick={() => setMenuOpen(false)} />
          <div className="menu">
            <button type="button" className="menu-item" onClick={() => { setMenuOpen(false); update.start() }}>
              Update library
            </button>
            {tabsVisible && (
              <button type="button" className="menu-item" onClick={updateCurrent}>
                Update kategori ini
              </button>
            )}
            <button type="button" className="menu-item" onClick={() => { setMenuOpen(false); refetch() }}>
              Muat ulang tampilan
            </button>
          </div>
        </>
      )}

      <PullIndicator distance={pull} />

      {isLoading && <div className="spinner" />}
      {error && (
        <div className="empty-state">
          <span className="error-text">{(error as Error).message}</span>
          <button type="button" className="btn btn-tonal" onClick={() => refetch()}>
            Coba lagi
          </button>
        </div>
      )}

      {mangas && mangas.length === 0 && (
        <div className="empty-state">
          <span className="empty-face">(･o･;)</span>
          <span>Library kosong</span>
        </div>
      )}
      {mangas && mangas.length > 0 && visible.length === 0 && (
        <div className="empty-state">
          <span className="empty-face">(･o･;)</span>
          <span>Tidak ada yang cocok dengan filter</span>
        </div>
      )}

      {visible.length > 0 && (
        <MangaGrid displayMode={display} columns={columns}>
          {visible.map((m) => (
            <MangaCard
              key={m.id}
              manga={m}
              displayMode={display}
              selected={selected.includes(m.id)}
              selectionMode={selectionMode}
              onToggleSelect={toggle}
              continueChapterId={continueButton ? m.firstUnreadChapter?.id : undefined}
              badges={
                <>
                  {badgeDownloaded && m.downloadCount > 0 && <span className="badge badge-downloaded">{m.downloadCount}</span>}
                  {badgeUnread && m.unreadCount > 0 && <span className="badge badge-unread">{m.unreadCount}</span>}
                  {badgeLang && m.source && <span className="badge badge-lang">{m.source.lang.toUpperCase()}</span>}
                </>
              }
            />
          ))}
        </MangaGrid>
      )}

      {selectionMode && (
        <div className="action-bar">
          <button type="button" disabled={busy} onClick={() => setDialog('category')}>
            <Icon name="label" />
            <span>Kategori</span>
          </button>
          <button type="button" disabled={busy} onClick={() => markRead(true)}>
            <Icon name="doneAll" />
            <span>Dibaca</span>
          </button>
          <button type="button" disabled={busy} onClick={() => markRead(false)}>
            <Icon name="removeDone" />
            <span>Belum</span>
          </button>
          <button type="button" disabled={busy} onClick={downloadUnread}>
            <Icon name="download" />
            <span>Unduh</span>
          </button>
          <button type="button" disabled={busy} onClick={() => setDialog('remove')}>
            <Icon name="delete" />
            <span>Hapus</span>
          </button>
        </div>
      )}

      <Dialog
        open={dialog === 'category'}
        title="Pindah ke kategori"
        onClose={() => setDialog(null)}
        actions={
          <button type="button" className="btn btn-text" onClick={() => setDialog(null)}>
            Batal
          </button>
        }
      >
        {data?.categories.map((c) => (
          <button
            key={c.id}
            type="button"
            className="list-item"
            disabled={busy}
            onClick={() => runBulk(() => setMangasCategory(selected, c.id))}
          >
            {c.name}
          </button>
        ))}
      </Dialog>

      <Dialog
        open={dialog === 'remove'}
        title="Hapus dari library?"
        onClose={() => setDialog(null)}
        actions={
          <>
            <button type="button" className="btn btn-text" onClick={() => setDialog(null)}>
              Batal
            </button>
            <button
              type="button"
              className="btn btn-text"
              disabled={busy}
              onClick={() => runBulk(() => setMangasInLibrary(selected, false))}
            >
              Hapus
            </button>
          </>
        }
      >
        {selected.length} manga akan dikeluarkan dari library. Chapter yang sudah diunduh tidak ikut dihapus.
      </Dialog>

      <LibrarySheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </div>
  )
}

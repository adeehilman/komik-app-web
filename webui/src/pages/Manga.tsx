import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { fetchMangaDetail, refreshMangaDetail, setMangaInLibrary, statusLabel } from '../api/manga'
import {
  deleteDownloads,
  enqueueDownloads,
  fetchMangaChapters,
  refreshMangaChapters,
  updateChapters,
} from '../api/chapter'
import type { ChapterPatch } from '../api/chapter'
import { TopBar } from '../components/TopBar'
import { Icon } from '../components/Icon'
import { ChapterRow } from '../components/ChapterRow'
import './Manga.css'

export function MangaPage() {
  const id = Number(useParams().mangaId)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const manga = useQuery({ queryKey: ['manga', id], queryFn: () => fetchMangaDetail(id) })
  const chapters = useQuery({ queryKey: ['chapters', id], queryFn: () => fetchMangaChapters(id) })

  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [newestFirst, setNewestFirst] = useState(true)
  const [selected, setSelected] = useState<number[]>([])
  const [busy, setBusy] = useState(false)

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['manga', id] }),
      queryClient.invalidateQueries({ queryKey: ['chapters', id] }),
      queryClient.invalidateQueries({ queryKey: ['library'] }),
    ])

  const refresh = async (opts: { detail: boolean; chapters: boolean }) => {
    setRefreshing(true)
    setRefreshError(null)
    try {
      await Promise.all([
        opts.detail ? refreshMangaDetail(id) : null,
        opts.chapters ? refreshMangaChapters(id) : null,
      ])
      await invalidate()
    } catch (e) {
      setRefreshError((e as Error).message)
    } finally {
      setRefreshing(false)
    }
  }

  // Manga baru dari Browse belum punya detail/chapter → ambil dari source sekali (seperti Mihon).
  const autoFetched = useRef(false)
  useEffect(() => {
    if (autoFetched.current || !manga.data || !chapters.data) return
    const needDetail = !manga.data.initialized
    const needChapters = chapters.data.length === 0
    if (needDetail || needChapters) {
      autoFetched.current = true
      refresh({ detail: needDetail, chapters: needChapters })
    }
    // refresh sengaja tidak masuk deps: hanya sekali per halaman
  }, [manga.data, chapters.data])

  const list = useMemo(() => {
    const all = chapters.data ?? []
    return newestFirst ? [...all].reverse() : all
  }, [chapters.data, newestFirst])

  // Chapter lanjut: chapter belum dibaca paling lama (sourceOrder terkecil).
  const nextChapter = chapters.data?.find((c) => !c.isRead)
  const hasProgress = chapters.data?.some((c) => c.isRead || c.lastPageRead > 0)

  const toggleLibrary = async () => {
    if (!manga.data) return
    await setMangaInLibrary(id, !manga.data.inLibrary)
    await invalidate()
  }

  const toggle = (cid: number) =>
    setSelected((prev) => (prev.includes(cid) ? prev.filter((x) => x !== cid) : [...prev, cid]))

  const bulk = async (action: () => Promise<void>) => {
    setBusy(true)
    try {
      await action()
      setSelected([])
      await invalidate()
    } catch (e) {
      window.alert(`Gagal: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  const patch = (p: ChapterPatch) => bulk(() => updateChapters(selected, p))

  /** Tandai semua chapter sebelum chapter terpilih (sourceOrder lebih kecil) sebagai dibaca. */
  const markPreviousRead = () => {
    const target = chapters.data?.find((c) => c.id === selected[0])
    if (!target) return
    const ids = (chapters.data ?? []).filter((c) => c.sourceOrder < target.sourceOrder && !c.isRead).map((c) => c.id)
    bulk(() => updateChapters(ids, { isRead: true }))
  }

  const selectedChapters = (chapters.data ?? []).filter((c) => selected.includes(c.id))
  const m = manga.data

  return (
    <div className="manga-page">
      {selected.length > 0 ? (
        <TopBar
          title={`${selected.length} dipilih`}
          actions={
            <>
              <button
                type="button"
                className="icon-btn"
                aria-label="Pilih semua"
                onClick={() => setSelected((chapters.data ?? []).map((c) => c.id))}
              >
                <Icon name="selectAll" />
              </button>
              <button type="button" className="icon-btn" aria-label="Batal" onClick={() => setSelected([])}>
                <Icon name="close" />
              </button>
            </>
          }
        />
      ) : (
        <TopBar
          back
          title={m?.title ?? ''}
          actions={
            <button
              type="button"
              className="icon-btn"
              aria-label="Perbarui dari source"
              disabled={refreshing}
              onClick={() => refresh({ detail: true, chapters: true })}
            >
              <Icon name="refresh" />
            </button>
          }
          below={
            refreshing ? (
              <div className="progress-bar indeterminate">
                <div className="progress-bar-fill" />
              </div>
            ) : undefined
          }
        />
      )}

      {manga.isLoading && <div className="spinner" />}
      {manga.error && <div className="error-text">{(manga.error as Error).message}</div>}

      {m && (
        <>
          <section className="manga-header">
            {m.thumbnailUrl && <div className="manga-backdrop" style={{ backgroundImage: `url("${m.thumbnailUrl}")` }} />}
            <div className="manga-header-row">
              <div className="manga-cover">{m.thumbnailUrl && <img src={m.thumbnailUrl} alt="" />}</div>
              <div className="manga-info">
                <h1 className="manga-title">{m.title}</h1>
                {(m.author || m.artist) && (
                  <span className="manga-sub">
                    {[m.author, m.artist && m.artist !== m.author ? m.artist : null].filter(Boolean).join(', ')}
                  </span>
                )}
                <span className="manga-sub">
                  {statusLabel(m.status)}
                  {m.source && ` • ${m.source.displayName}`}
                </span>
              </div>
            </div>
            <div className="manga-actions">
              <button type="button" className={`manga-action ${m.inLibrary ? 'active' : ''}`} onClick={toggleLibrary}>
                <Icon name={m.inLibrary ? 'heart' : 'heartOutline'} />
                <span>{m.inLibrary ? 'Di library' : 'Tambah ke library'}</span>
              </button>
              {m.realUrl && (
                <a className="manga-action" href={m.realUrl} target="_blank" rel="noreferrer">
                  <Icon name="web" />
                  <span>WebView</span>
                </a>
              )}
            </div>
          </section>

          {m.description && (
            <section className={`manga-description ${expanded ? 'expanded' : ''}`} onClick={() => setExpanded((v) => !v)}>
              <p>{m.description}</p>
              <span className="manga-expand">{expanded ? 'Lebih sedikit' : 'Selengkapnya'}</span>
            </section>
          )}
          {m.genre.length > 0 && (
            <div className={`chip-row ${expanded ? 'wrap' : ''}`}>
              {m.genre.map((g) => (
                <span key={g} className="chip">
                  {g}
                </span>
              ))}
            </div>
          )}
        </>
      )}

      {refreshError && <div className="error-text">Gagal mengambil dari source: {refreshError}</div>}

      <div className="chapter-header">
        <span>{chapters.data ? `${chapters.data.length} chapter` : 'Chapter'}</span>
        <button type="button" className="icon-btn" aria-label="Urutan" onClick={() => setNewestFirst((v) => !v)}>
          <span className="sort-arrow">{newestFirst ? '↓' : '↑'}</span>
        </button>
      </div>

      {chapters.isLoading && <div className="spinner" />}
      {chapters.data?.length === 0 && !refreshing && <div className="empty-state">Belum ada chapter</div>}
      {list.map((c) => (
        <ChapterRow
          key={c.id}
          chapter={c}
          selected={selected.includes(c.id)}
          selectionMode={selected.length > 0}
          onToggleSelect={toggle}
          onDownload={(cid) => enqueueDownloads([cid]).then(invalidate)}
        />
      ))}
      <div className="manga-bottom-space" />

      {nextChapter && selected.length === 0 && (
        <button type="button" className="fab" onClick={() => navigate(`/reader/${nextChapter.id}`)}>
          <Icon name="play" />
          {hasProgress ? 'Lanjutkan' : 'Mulai'}
        </button>
      )}

      {selected.length > 0 && (
        <div className="action-bar">
          {selectedChapters.some((c) => !c.isBookmarked) ? (
            <button type="button" disabled={busy} onClick={() => patch({ isBookmarked: true })}>
              <Icon name="bookmark" />
              <span>Bookmark</span>
            </button>
          ) : (
            <button type="button" disabled={busy} onClick={() => patch({ isBookmarked: false })}>
              <Icon name="bookmarkOutline" />
              <span>Lepas</span>
            </button>
          )}
          <button type="button" disabled={busy} onClick={() => patch({ isRead: true, lastPageRead: 0 })}>
            <Icon name="doneAll" />
            <span>Dibaca</span>
          </button>
          <button type="button" disabled={busy} onClick={() => patch({ isRead: false, lastPageRead: 0 })}>
            <Icon name="removeDone" />
            <span>Belum</span>
          </button>
          {selected.length === 1 && (
            <button type="button" disabled={busy} onClick={markPreviousRead}>
              <Icon name="check" />
              <span>Sebelumnya</span>
            </button>
          )}
          {selectedChapters.some((c) => !c.isDownloaded) ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => bulk(() => enqueueDownloads(selectedChapters.filter((c) => !c.isDownloaded).map((c) => c.id)))}
            >
              <Icon name="download" />
              <span>Unduh</span>
            </button>
          ) : (
            <button type="button" disabled={busy} onClick={() => bulk(() => deleteDownloads(selected))}>
              <Icon name="delete" />
              <span>Hapus</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

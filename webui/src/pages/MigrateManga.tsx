import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { Icon } from '../components/Icon'
import { serverPath } from '../api/base'
import { fetchMangaDetail, setMangaInLibrary } from '../api/manga'
import { fetchMangaChapters } from '../api/chapter'
import { fetchCategories } from '../api/library'
import { fetchSourceManga, fetchSources } from '../api/source'
import type { SourceMangaItem } from '../api/source'
import { runMigration } from '../api/migrate'
import type { MigrationSummary } from '../api/migrate'
import './MigrateManga.css'

type Step = 'source' | 'search' | 'confirm' | 'done'

function Thumb({ src, alt }: { src?: string; alt: string }) {
  const [gone, setGone] = useState(false)
  if (!src || gone) return <div className="migrate-thumb migrate-thumb-empty" />
  return <img className="migrate-thumb" src={serverPath(src)} alt={alt} loading="lazy" onError={() => setGone(true)} />
}

export function MigrateMangaPage() {
  const id = Number(useParams().mangaId)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const manga = useQuery({ queryKey: ['manga', id], queryFn: () => fetchMangaDetail(id) })
  const chapters = useQuery({ queryKey: ['chapters', id], queryFn: () => fetchMangaChapters(id) })
  const sources = useQuery({ queryKey: ['sources'], queryFn: fetchSources })
  const cats = useQuery({ queryKey: ['categories'], queryFn: fetchCategories })

  const [step, setStep] = useState<Step>('source')
  const [targetSourceId, setTargetSourceId] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('')
  const [target, setTarget] = useState<SourceMangaItem | null>(null)
  const [includeChapters, setIncludeChapters] = useState(true)
  const [includeCategories, setIncludeCategories] = useState(true)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [summary, setSummary] = useState<MigrationSummary | null>(null)
  const [sourceHidden, setSourceHidden] = useState(false)
  const [hiding, setHiding] = useState(false)

  const search = useQuery({
    queryKey: ['migrateSearch', targetSourceId, submittedQuery],
    queryFn: () => fetchSourceManga(targetSourceId!, 'SEARCH', 1, submittedQuery),
    enabled: step !== 'source' && !!targetSourceId && submittedQuery.length > 0,
  })

  const sourceName = manga.data?.source?.displayName ?? 'Sumber lama'
  const targetSource = sources.data?.find((s) => s.id === targetSourceId)
  const readCount = useMemo(() => (chapters.data ?? []).filter((c) => c.isRead).length, [chapters.data])
  const bookmarkCount = useMemo(() => (chapters.data ?? []).filter((c) => c.isBookmarked).length, [chapters.data])
  const catNames = useMemo(() => {
    const byId = new Map((cats.data ?? []).map((c) => [c.id, c.name]))
    return (manga.data?.categories.nodes ?? []).map((c) => byId.get(c.id) ?? `#${c.id}`)
  }, [cats.data, manga.data])

  const pickSource = (sourceId: string) => {
    setTargetSourceId(sourceId)
    setTarget(null)
    setSummary(null)
    setError('')
    const q = manga.data?.title ?? ''
    setSearchInput(q)
    setSubmittedQuery(q)
    setStep('search')
  }

  const submitSearch = (e?: React.FormEvent) => {
    e?.preventDefault()
    setTarget(null)
    setError('')
    setSubmittedQuery(searchInput.trim())
  }

  const startMigration = async () => {
    if (!target) return
    setRunning(true)
    setError('')
    setProgress('Memulai…')
    try {
      const result = await runMigration({
        sourceId: id,
        targetId: target.id,
        includeChapters,
        includeCategories,
        onProgress: setProgress,
      })
      setSummary(result)
      setStep('done')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['manga', target.id] }),
        queryClient.invalidateQueries({ queryKey: ['chapters', target.id] }),
        queryClient.invalidateQueries({ queryKey: ['library'] }),
        queryClient.invalidateQueries({ queryKey: ['migration'] }),
      ])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Migrasi gagal')
    } finally {
      setRunning(false)
      setProgress('')
    }
  }

  const hideSource = async () => {
    setHiding(true)
    try {
      await setMangaInLibrary(id, false)
      setSourceHidden(true)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['library'] }),
        queryClient.invalidateQueries({ queryKey: ['migration'] }),
        queryClient.invalidateQueries({ queryKey: ['manga', id] }),
      ])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyembunyikan sumber lama')
    } finally {
      setHiding(false)
    }
  }

  const m = manga.data
  const sourceList = (sources.data ?? []).filter((s) => s.id !== '0' && s.id !== m?.source?.id)

  return (
    <div className="migrate-page">
      <TopBar back title="Migrasi" subtitle={m?.title ?? ''} />

      {manga.isLoading && <div className="spinner" />}
      {manga.error && <div className="error-text">{(manga.error as Error).message}</div>}

      {m && (
        <div className="migrate-source-card">
          <Thumb src={m.thumbnailUrl ?? undefined} alt="" />
          <div className="migrate-source-text">
            <span className="migrate-source-title">{m.title}</span>
            <span className="migrate-source-meta">
              {sourceName} • {chapters.data?.length ?? '?'} chapter • {readCount} terbaca
            </span>
          </div>
        </div>
      )}

      {step === 'source' && (
        <>
          <p className="migrate-note">
            Pilih extension tujuan yang sudah terpasang. Judul yang sama akan dicari di extension itu, lalu kategori
            dan progres baca dipindah — tanpa membuat duplikat di library.
          </p>
          {sources.isLoading && <div className="spinner" />}
          {sources.error && <div className="error-text">{(sources.error as Error).message}</div>}
          {sourceList.length === 0 && !sources.isLoading && (
            <p className="migrate-empty">Tidak ada extension lain yang terpasang.</p>
          )}
          {sourceList.map((s) => (
            <button key={s.id} type="button" className="migrate-row" onClick={() => pickSource(s.id)}>
              {s.iconUrl ? (
                <img className="migrate-source-icon" src={serverPath(s.iconUrl)} alt="" loading="lazy" />
              ) : (
                <span className="migrate-source-icon migrate-source-icon-empty">{s.displayName[0]}</span>
              )}
              <span className="migrate-row-text">
                <span className="migrate-row-title">{s.displayName}</span>
                <span className="migrate-row-meta">{s.lang.toUpperCase()}</span>
              </span>
              <Icon name="chevronRight" size={20} />
            </button>
          ))}
        </>
      )}

      {step === 'search' && targetSource && (
        <>
          <p className="migrate-note">
            Cari judul yang sama di <b>{targetSource.displayName}</b>. Pilih entri yang cocok — judulnya tidak harus
            sama persis.
          </p>
          <form className="migrate-search" onSubmit={submitSearch}>
            <input
              className="migrate-search-input"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Judul di extension tujuan"
              aria-label="Cari judul"
            />
            <button type="submit" className="migrate-btn" disabled={search.isFetching}>
              Cari
            </button>
          </form>
          <button type="button" className="btn btn-text" onClick={() => setStep('source')}>
            ← Ganti extension
          </button>
          {search.isFetching && <div className="spinner" />}
          {search.error && <div className="error-text">{(search.error as Error).message}</div>}
          {search.data && search.data.mangas.length === 0 && (
            <p className="migrate-empty">Tidak ketemu. Coba kata kunci lain, atau periksa ejaannya.</p>
          )}
          {search.data?.mangas.map((r) => (
            <button
              key={r.id}
              type="button"
              className="migrate-row"
              onClick={() => {
                setTarget(r)
                setStep('confirm')
              }}
            >
              <Thumb src={r.thumbnailUrl ?? undefined} alt="" />
              <span className="migrate-row-text">
                <span className="migrate-row-title">{r.title}</span>
                <span className="migrate-row-meta">{r.inLibrary ? 'Sudah di library — progres akan digabung' : 'Belum di library'}</span>
              </span>
            </button>
          ))}
        </>
      )}

      {step === 'confirm' && target && targetSource && (
        <>
          <div className="migrate-confirm">
            <div className="migrate-confirm-row">
              <span className="migrate-confirm-label">Dari</span>
              <span>
                {m?.title} <span className="migrate-confirm-meta">({sourceName})</span>
              </span>
            </div>
            <div className="migrate-confirm-row">
              <span className="migrate-confirm-label">Ke</span>
              <span>
                {target.title} <span className="migrate-confirm-meta">({targetSource.displayName})</span>
              </span>
            </div>
          </div>
          <p className="migrate-note">Pilih data yang dibawa:</p>
          <label className="list-item">
            <input type="checkbox" checked={includeChapters} onChange={(e) => setIncludeChapters(e.target.checked)} />
            <span className="list-item-title">
              Chapter — {readCount} terbaca, {bookmarkCount} bookmark
              <span className="migrate-item-hint">dicocokkan per nomor chapter; yang tidak ada pasangannya dilewati</span>
            </span>
          </label>
          <label className="list-item">
            <input
              type="checkbox"
              checked={includeCategories}
              onChange={(e) => setIncludeCategories(e.target.checked)}
            />
            <span className="list-item-title">
              Kategori — {catNames.length > 0 ? catNames.join(', ') : 'Default'}
              <span className="migrate-item-hint">kategori tujuan diganti dengan kategori sumber</span>
            </span>
          </label>
          <p className="migrate-note">
            Unduhan tidak ikut dipindah — unduh ulang chapter di sumber baru bila perlu.
          </p>
          {error && <div className="error-text">{error}</div>}
          <div className="migrate-actions">
            <button type="button" className="btn btn-text" disabled={running} onClick={() => setStep('search')}>
              Kembali
            </button>
            <button type="button" className="migrate-btn" disabled={running || (!includeChapters && !includeCategories)} onClick={startMigration}>
              {running ? 'Memigrasi…' : 'Migrasi'}
            </button>
          </div>
          {running && (
            <p className="migrate-progress">
              <span className="spinner spinner-inline" /> {progress}
            </p>
          )}
        </>
      )}

      {step === 'done' && summary && (
        <>
          <p className="migrate-note">
            <b>Migrasi selesai.</b> {summary.targetTitle} sekarang di library dengan progres dari {sourceName}.
          </p>
          <ul className="migrate-result">
            <li>
              {summary.readCopied} chapter ditandai terbaca
              {summary.targetChapterCount > 0 ? ` (dari ${summary.sourceChapterCount} chapter sumber → ${summary.targetChapterCount} chapter tujuan)` : ''}
            </li>
            <li>{summary.bookmarkCopied} bookmark disalin</li>
            {summary.progressCopied && <li>Posisi baca terakhir disalin ({summary.progressChapterName})</li>}
            {includeCategories && (
              <li>Kategori disalin ({summary.categoryIds.length > 0 ? `${summary.categoryIds.length} kategori` : 'Default'})</li>
            )}
            {summary.targetInLibraryBefore && <li>Judul tujuan sudah ada di library sebelumnya — progres digabung, tidak duplikat</li>}
          </ul>
          {summary.unmatched.length > 0 && (
            <p className="migrate-note">
              {summary.unmatched.length} chapter sumber tidak punya pasangan di tujuan dan dilewati
              {summary.unmatched.slice(0, 5).map((c) => ` — ${c.name}`).join('')}
              {summary.unmatched.length > 5 ? ` (+${summary.unmatched.length - 5} lagi)` : ''}.
            </p>
          )}
          <div className="migrate-actions migrate-actions-col">
            <button type="button" className="migrate-btn" onClick={() => navigate(`/manga/${summary.targetId}`)}>
              Lihat judul baru
            </button>
            {sourceHidden ? (
              <p className="migrate-note">Sumber lama sudah disembunyikan dari library.</p>
            ) : (
              <button type="button" className="btn btn-text" disabled={hiding} onClick={hideSource}>
                {hiding ? '…' : 'Sembunyikan sumber lama dari library'}
              </button>
            )}
            <button type="button" className="btn btn-text" onClick={() => navigate(`/manga/${id}`)}>
              Kembali ke judul lama
            </button>
          </div>
          {error && <div className="error-text">{error}</div>}
        </>
      )}
    </div>
  )
}

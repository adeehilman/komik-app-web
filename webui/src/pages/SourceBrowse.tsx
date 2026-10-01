import { useEffect, useRef, useState } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useParams, useSearchParams } from 'react-router-dom'
import { fetchSource, fetchSourceManga } from '../api/source'
import type { BrowseType } from '../api/source'
import { TopBar } from '../components/TopBar'
import { Icon } from '../components/Icon'
import { MangaCard, MangaGrid } from '../components/MangaCard'
import './Browse.css'

/** Daftar manga satu source: Popular / Latest / hasil pencarian, dengan infinite scroll. */
export function SourceBrowsePage() {
  const { sourceId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const type: BrowseType = query ? 'SEARCH' : params.get('type') === 'LATEST' ? 'LATEST' : 'POPULAR'
  const [searchOpen, setSearchOpen] = useState(!!query)
  const [draft, setDraft] = useState(query)

  const { data: source } = useQuery({ queryKey: ['source', sourceId], queryFn: () => fetchSource(sourceId) })

  const result = useInfiniteQuery({
    queryKey: ['sourceManga', sourceId, type, query],
    queryFn: ({ pageParam }) => fetchSourceManga(sourceId, type, pageParam, query),
    initialPageParam: 1,
    getNextPageParam: (last, pages) => (last.hasNextPage ? pages.length + 1 : undefined),
    staleTime: 10 * 60 * 1000,
  })

  // Muat halaman berikutnya saat sentinel di bawah terlihat.
  const sentinel = useRef<HTMLDivElement>(null)
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = result
  useEffect(() => {
    const el = sentinel.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage()
      },
      { rootMargin: '600px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const submitSearch = () => {
    const q = draft.trim()
    setParams(q ? { q } : {}, { replace: true })
  }

  const setType = (t: BrowseType) => setParams(t === 'LATEST' ? { type: 'LATEST' } : {}, { replace: true })

  // Hasil antar halaman bisa duplikat — buang berdasarkan id.
  const seen = new Set<number>()
  const mangas = (result.data?.pages ?? []).flatMap((p) => p.mangas).filter((m) => !seen.has(m.id) && seen.add(m.id))

  return (
    <div className="browse-page">
      <TopBar
        back
        title={source?.displayName ?? 'Source'}
        actions={
          <button type="button" className="icon-btn" aria-label="Cari" onClick={() => setSearchOpen(true)}>
            <Icon name="search" />
          </button>
        }
        below={
          <>
            {!query && (
              <div className="chip-row">
                <button type="button" className={`chip ${type === 'POPULAR' ? 'active' : ''}`} onClick={() => setType('POPULAR')}>
                  Popular
                </button>
                {source?.supportsLatest && (
                  <button type="button" className={`chip ${type === 'LATEST' ? 'active' : ''}`} onClick={() => setType('LATEST')}>
                    Latest
                  </button>
                )}
              </div>
            )}
            {result.isFetching && (
              <div className="progress-bar indeterminate">
                <div className="progress-bar-fill" />
              </div>
            )}
          </>
        }
      >
        {searchOpen ? (
          <>
            <form
              className="source-search"
              onSubmit={(e) => {
                e.preventDefault()
                submitSearch()
              }}
            >
              <input
                className="top-bar-search"
                type="search"
                enterKeyHint="search"
                autoFocus
                placeholder={`Cari di ${source?.name ?? 'source'}…`}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
            </form>
            <button
              type="button"
              className="icon-btn"
              aria-label="Tutup pencarian"
              onClick={() => {
                setSearchOpen(false)
                setDraft('')
                setParams({}, { replace: true })
              }}
            >
              <Icon name="close" />
            </button>
          </>
        ) : undefined}
      </TopBar>

      {result.isLoading && <div className="spinner" />}
      {result.error && (
        <div className="empty-state">
          <span className="error-text">{(result.error as Error).message}</span>
          <button type="button" className="btn btn-tonal" onClick={() => result.refetch()}>
            Coba lagi
          </button>
        </div>
      )}
      {result.data && mangas.length === 0 && (
        <div className="empty-state">
          <span className="empty-face">(･o･;)</span>
          <span>Tidak ada hasil</span>
        </div>
      )}

      <MangaGrid displayMode="compact" columns={0}>
        {mangas.map((m) => (
          <MangaCard
            key={m.id}
            manga={m}
            displayMode="compact"
            dimmed={m.inLibrary}
            badges={m.inLibrary ? <span className="badge badge-plain">In library</span> : undefined}
          />
        ))}
      </MangaGrid>
      {isFetchingNextPage && <div className="spinner" />}
      <div ref={sentinel} className="browse-sentinel" />
    </div>
  )
}

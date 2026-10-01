import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { fetchChapterPages, fetchMangaChapters, fetchReaderChapter, updateChapters } from '../api/chapter'
import { Icon } from '../components/Icon'
import { Sheet } from '../components/Sheet'
import { useMangaSetting, useSetting } from '../settings/useSetting'
import type { SettingsSchema } from '../settings/schema'
import { PagedViewer } from '../reader/PagedViewer'
import { WebtoonViewer } from '../reader/WebtoonViewer'
import type { WebtoonHandle } from '../reader/WebtoonViewer'
import { NEXT_CHAPTER_THRESHOLD, preloadAround, preloadImage } from '../reader/preload'
import './Reader.css'

type ReaderMode = SettingsSchema['mihonweb_reader_mode']

const MODES: Array<{ key: ReaderMode; label: string }> = [
  { key: 'rtl', label: 'Kanan ke kiri' },
  { key: 'ltr', label: 'Kiri ke kanan' },
  { key: 'vertical', label: 'Vertikal' },
  { key: 'webtoon', label: 'Webtoon' },
]

const BG: Record<SettingsSchema['mihonweb_reader_bg'], string> = {
  black: '#000000',
  gray: '#202125',
  white: '#ffffff',
}

const SAVE_DELAY_MS = 500

/** Route wrapper: remount penuh tiap ganti chapter supaya state halaman bersih. */
export function ReaderRoute() {
  const { chapterId } = useParams()
  return <Reader key={chapterId} chapterId={Number(chapterId)} />
}

function Reader({ chapterId }: { chapterId: number }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const chapter = useQuery({
    queryKey: ['readerChapter', chapterId],
    queryFn: () => fetchReaderChapter(chapterId),
    staleTime: 0,
  })
  const pages = useQuery({
    queryKey: ['chapterPages', chapterId],
    queryFn: () => fetchChapterPages(chapterId),
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
  })
  const mangaId = chapter.data?.mangaId
  const siblings = useQuery({
    queryKey: ['chapters', mangaId],
    queryFn: () => fetchMangaChapters(mangaId as number),
    enabled: mangaId !== undefined,
  })

  const mode = useMangaSetting(mangaId, 'mihonweb_reader_mode')
  const [fit, setFit] = useSetting('mihonweb_reader_fit')
  const [bg, setBg] = useSetting('mihonweb_reader_bg')
  const [tapZones, setTapZones] = useSetting('mihonweb_reader_tap_zones')
  const [gap, setGap] = useSetting('mihonweb_reader_webtoon_gap')

  const [index, setIndex] = useState<number | null>(null)
  /** Halaman awal saat chapter dibuka; dibekukan supaya webtoon tidak melompat saat digulir. */
  const [startIndex, setStartIndex] = useState(0)
  const [menu, setMenu] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const webtoon = useRef<WebtoonHandle>(null)

  const pageList = useMemo(() => pages.data ?? [], [pages.data])
  const total = pageList.length

  // Chapter sebelum/sesudah berdasarkan sourceOrder (1 = paling lama).
  const { prev, next } = useMemo(() => {
    const list = siblings.data ?? []
    const i = list.findIndex((c) => c.id === chapterId)
    return { prev: i > 0 ? list[i - 1] : undefined, next: i >= 0 ? list[i + 1] : undefined }
  }, [siblings.data, chapterId])

  // Posisi awal: lanjut dari lastPageRead kecuali chapter sudah selesai.
  useEffect(() => {
    if (index !== null || !chapter.data || total === 0) return
    const c = chapter.data
    const start = c.isRead ? 0 : Math.min(Math.max(0, c.lastPageRead), total - 1)
    setStartIndex(start)
    setIndex(start)
  }, [chapter.data, total, index])

  /* ---------- Simpan progres ke server (debounce) ---------- */
  const markedRead = useRef(false)
  useEffect(() => {
    if (index === null || total === 0) return
    const page = Math.min(index, total - 1)
    const finished = index >= total - 1
    const timer = window.setTimeout(() => {
      const patch = finished && !markedRead.current ? { lastPageRead: page, isRead: true } : { lastPageRead: page }
      if (finished) markedRead.current = true
      updateChapters([chapterId], patch).catch(() => {
        if (finished) markedRead.current = false
      })
    }, SAVE_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [index, total, chapterId])

  // Saat keluar reader: segarkan daftar yang menampilkan progres.
  useEffect(() => {
    return () => {
      for (const key of ['chapters', 'library', 'history', 'updates', 'readerChapter']) {
        queryClient.invalidateQueries({ queryKey: [key] })
      }
    }
  }, [queryClient])

  /* ---------- Preload ---------- */
  useEffect(() => {
    if (index === null || total === 0) return
    preloadAround(pageList, index)
    if (next && total - index <= NEXT_CHAPTER_THRESHOLD) {
      queryClient
        .prefetchQuery({ queryKey: ['chapterPages', next.id], queryFn: () => fetchChapterPages(next.id), staleTime: Infinity })
        .then(() => {
          const nextPages = queryClient.getQueryData<string[]>(['chapterPages', next.id])
          nextPages?.slice(0, 6).forEach(preloadImage)
        })
    }
  }, [index, total, pageList, next, queryClient])

  /* ---------- Navigasi ---------- */
  const goChapter = useCallback(
    (id: number | undefined) => {
      if (id !== undefined) navigate(`/reader/${id}`, { replace: true })
    },
    [navigate],
  )

  const onNext = () => {
    if (index === null) return
    if (index < total) setIndex(index + 1)
    else goChapter(next?.id)
  }
  const onPrev = () => {
    if (index === null) return
    if (index > 0) setIndex(index - 1)
    else goChapter(prev?.id)
  }

  const onWebtoonPage = useCallback((i: number) => setIndex(i), [])
  const onWebtoonEnd = useCallback(() => setIndex(total), [total])
  const toggleMenu = useCallback(() => setMenu((v) => !v), [])

  const jumpTo = (i: number) => {
    setIndex(i)
    if (mode.value === 'webtoon') webtoon.current?.scrollToPage(i)
  }

  const transition = (
    <>
      <p className="transition-label">Selesai</p>
      <p className="transition-chapter">{chapter.data?.name}</p>
      {next ? (
        <>
          <p className="transition-label">Berikutnya</p>
          <p className="transition-chapter">{next.name}</p>
          <button
            type="button"
            className="btn"
            onClick={(e) => {
              e.stopPropagation()
              goChapter(next.id)
            }}
          >
            Baca chapter berikutnya
          </button>
        </>
      ) : (
        <>
          <p className="transition-label">Tidak ada chapter berikutnya</p>
          {mangaId !== undefined && (
            <Link to={`/manga/${mangaId}`} replace className="btn btn-tonal" onClick={(e) => e.stopPropagation()}>
              Kembali ke detail
            </Link>
          )}
        </>
      )}
    </>
  )

  const error = chapter.error ?? pages.error
  const shownPage = index === null ? 0 : Math.min(index, total - 1)

  return (
    <div className={`reader bg-${bg}`} style={{ backgroundColor: BG[bg] }}>
      {error && (
        <div className="reader-center">
          <p className="error-text">{(error as Error).message}</p>
          <button type="button" className="btn btn-tonal" onClick={() => pages.refetch()}>
            Coba lagi
          </button>
          <button type="button" className="btn btn-text" onClick={() => navigate(-1)}>
            Kembali
          </button>
        </div>
      )}
      {!error && index === null && <div className="spinner reader-spinner" />}

      {!error && index !== null && total > 0 &&
        (mode.value === 'webtoon' ? (
          <WebtoonViewer
            ref={webtoon}
            pages={pageList}
            initialIndex={startIndex}
            gap={gap}
            tapZones={tapZones}
            onPageChange={onWebtoonPage}
            onReachEnd={onWebtoonEnd}
            onToggleMenu={toggleMenu}
            footer={transition}
          />
        ) : (
          <PagedViewer
            pages={pageList}
            index={index}
            direction={mode.value}
            fit={fit}
            tapZones={tapZones}
            onNext={onNext}
            onPrev={onPrev}
            onToggleMenu={toggleMenu}
            transition={transition}
          />
        ))}

      {menu && (
        <>
          <div className="reader-topbar">
            <button
              type="button"
              className="icon-btn"
              aria-label="Kembali"
              onClick={() => (mangaId !== undefined ? navigate(`/manga/${mangaId}`, { replace: true }) : navigate(-1))}
            >
              <Icon name="back" />
            </button>
            <div className="reader-titles">
              <span className="reader-manga">{chapter.data?.manga.title}</span>
              <span className="reader-chapter">{chapter.data?.name}</span>
            </div>
            <button type="button" className="icon-btn" aria-label="Setelan" onClick={() => setSettingsOpen(true)}>
              <Icon name="settings" />
            </button>
          </div>
          <div className="reader-bottombar">
            <button type="button" className="icon-btn" aria-label="Chapter sebelumnya" disabled={!prev} onClick={() => goChapter(prev?.id)}>
              <Icon name="skipPrev" />
            </button>
            <div className="reader-slider">
              <span>{shownPage + 1}</span>
              <input
                type="range"
                min={0}
                max={Math.max(0, total - 1)}
                value={shownPage}
                dir={mode.value === 'rtl' ? 'rtl' : 'ltr'}
                onChange={(e) => jumpTo(Number(e.target.value))}
              />
              <span>{total}</span>
            </div>
            <button type="button" className="icon-btn" aria-label="Chapter berikutnya" disabled={!next} onClick={() => goChapter(next?.id)}>
              <Icon name="skipNext" />
            </button>
          </div>
        </>
      )}

      <Sheet open={settingsOpen} onClose={() => setSettingsOpen(false)}>
        <div className="section-title">Mode baca</div>
        <div className="chip-row wrap">
          {MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              className={`chip ${mode.value === m.key ? 'active' : ''}`}
              onClick={() => (mode.isOverride ? mode.setForManga(m.key) : mode.setGlobal(m.key))}
            >
              {m.label}
            </button>
          ))}
        </div>
        <label className="list-item">
          <input
            type="checkbox"
            checked={mode.isOverride}
            onChange={(e) => (e.target.checked ? mode.setForManga(mode.value) : mode.clearOverride())}
          />
          <span className="list-item-text">
            <span className="list-item-title">Berlaku untuk judul ini saja</span>
            <span className="list-item-subtitle">Mati = ikut setelan global</span>
          </span>
        </label>

        {mode.value !== 'webtoon' && (
          <>
            <div className="section-title">Skala gambar</div>
            <div className="chip-row wrap">
              {(
                [
                  ['screen', 'Pas layar'],
                  ['width', 'Pas lebar'],
                  ['height', 'Pas tinggi'],
                ] as const
              ).map(([key, label]) => (
                <button key={key} type="button" className={`chip ${fit === key ? 'active' : ''}`} onClick={() => setFit(key)}>
                  {label}
                </button>
              ))}
            </div>
          </>
        )}

        {mode.value === 'webtoon' && (
          <label className="list-item">
            <span className="list-item-text">
              <span className="list-item-title">Jarak antar halaman</span>
              <span className="list-item-subtitle">{gap} px</span>
            </span>
            <input type="range" className="range" min={0} max={32} step={4} value={gap} onChange={(e) => setGap(Number(e.target.value))} />
          </label>
        )}

        <div className="section-title">Warna latar</div>
        <div className="chip-row">
          {(
            [
              ['black', 'Hitam'],
              ['gray', 'Abu-abu'],
              ['white', 'Putih'],
            ] as const
          ).map(([key, label]) => (
            <button key={key} type="button" className={`chip ${bg === key ? 'active' : ''}`} onClick={() => setBg(key)}>
              {label}
            </button>
          ))}
        </div>

        <label className="list-item">
          <input type="checkbox" checked={tapZones} onChange={(e) => setTapZones(e.target.checked)} />
          <span className="list-item-text">
            <span className="list-item-title">Navigasi tap</span>
            <span className="list-item-subtitle">Tap tepi layar untuk pindah halaman</span>
          </span>
        </label>
      </Sheet>
    </div>
  )
}

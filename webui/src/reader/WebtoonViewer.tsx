import { useEffect, useImperativeHandle, useRef } from 'react'
import type { ReactNode, Ref } from 'react'
import { PageImage } from './PageImage'

export interface WebtoonHandle {
  scrollToPage: (index: number) => void
}

interface WebtoonViewerProps {
  pages: string[]
  initialIndex: number
  gap: number
  tapZones: boolean
  onPageChange: (index: number) => void
  onReachEnd: () => void
  onToggleMenu: () => void
  footer: ReactNode
  ref?: Ref<WebtoonHandle>
}

/**
 * Mode webtoon: gulir panjang tanpa batas halaman.
 * Halaman aktif = halaman yang memotong garis tengah layar.
 * Saat melanjutkan baca, posisi "dikunci" ke halaman terakhir sampai pengguna menyentuh layar,
 * karena gambar di atasnya yang selesai dimuat mengubah tinggi konten.
 */
export function WebtoonViewer({
  pages,
  initialIndex,
  gap,
  tapZones,
  onPageChange,
  onReachEnd,
  onToggleMenu,
  footer,
  ref,
}: WebtoonViewerProps) {
  const container = useRef<HTMLDivElement>(null)
  const pageRefs = useRef<Array<HTMLDivElement | null>>([])
  const pinned = useRef(initialIndex > 0)
  const endRef = useRef<HTMLDivElement>(null)

  const scrollToPage = (index: number) => {
    pageRefs.current[index]?.scrollIntoView({ block: 'start' })
  }

  useImperativeHandle(ref, () => ({
    scrollToPage: (i: number) => {
      pinned.current = false
      scrollToPage(i)
    },
  }))

  useEffect(() => {
    if (initialIndex > 0) scrollToPage(initialIndex)
  }, [initialIndex])

  // Halaman aktif: elemen yang melewati garis tengah viewport.
  useEffect(() => {
    const root = container.current
    if (!root) return
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const i = Number((entry.target as HTMLElement).dataset.index)
          if (!pinned.current || i === initialIndex) onPageChange(i)
        }
      },
      { root, rootMargin: '-50% 0px -50% 0px' },
    )
    pageRefs.current.forEach((el) => el && io.observe(el))
    return () => io.disconnect()
  }, [pages, onPageChange, initialIndex])

  // Sampai di akhir chapter (footer terlihat).
  useEffect(() => {
    const root = container.current
    const el = endRef.current
    if (!root || !el) return
    const io = new IntersectionObserver(([e]) => e.isIntersecting && onReachEnd(), { root, threshold: 0.5 })
    io.observe(el)
    return () => io.disconnect()
  }, [onReachEnd])

  const unpin = () => {
    pinned.current = false
  }

  const handleTap = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!tapZones) return onToggleMenu()
    const y = e.clientY / window.innerHeight
    const root = container.current
    if (!root) return
    if (y < 0.3) root.scrollBy({ top: -window.innerHeight * 0.75, behavior: 'smooth' })
    else if (y > 0.7) root.scrollBy({ top: window.innerHeight * 0.75, behavior: 'smooth' })
    else onToggleMenu()
  }

  return (
    <div
      ref={container}
      className="webtoon-viewer"
      onClick={handleTap}
      onTouchStart={unpin}
      onWheel={unpin}
    >
      {pages.map((src, i) => (
        <div
          key={src}
          ref={(el) => {
            pageRefs.current[i] = el
          }}
          data-index={i}
          style={{ marginBottom: i < pages.length - 1 ? gap : 0 }}
        >
          <PageImage
            src={src}
            eager={Math.abs(i - initialIndex) <= 2}
            className="webtoon-page"
            onLoad={() => {
              if (pinned.current && i < initialIndex) scrollToPage(initialIndex)
            }}
          />
        </div>
      ))}
      <div ref={endRef} className="reader-transition webtoon-footer">
        {footer}
      </div>
    </div>
  )
}

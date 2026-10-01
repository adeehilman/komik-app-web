import { useRef } from 'react'
import type { ReactNode } from 'react'
import { PageImage } from './PageImage'

export type PagedDirection = 'ltr' | 'rtl' | 'vertical'
export type FitMode = 'width' | 'height' | 'screen'

interface PagedViewerProps {
  pages: string[]
  /** 0..pages.length; index === pages.length = halaman transisi akhir chapter. */
  index: number
  direction: PagedDirection
  fit: FitMode
  tapZones: boolean
  onNext: () => void
  onPrev: () => void
  onToggleMenu: () => void
  transition: ReactNode
}

const SWIPE_PX = 50

/**
 * Mode halaman per halaman (kiri→kanan, kanan→kiri, vertikal).
 * Tap kiri/kanan sepertiga layar = pindah halaman; tengah = menu. Swipe juga didukung.
 */
export function PagedViewer({
  pages,
  index,
  direction,
  fit,
  tapZones,
  onNext,
  onPrev,
  onToggleMenu,
  transition,
}: PagedViewerProps) {
  const touch = useRef<{ x: number; y: number; t: number } | null>(null)
  const swiped = useRef(false)
  /** Swipe di iOS kadang diikuti event click — telan click itu saja, lalu reset. */
  const markSwiped = () => {
    swiped.current = true
    window.setTimeout(() => {
      swiped.current = false
    }, 400)
  }

  const handleTap = (e: React.MouseEvent<HTMLDivElement>) => {
    if (swiped.current) {
      swiped.current = false
      return
    }
    if (!tapZones) return onToggleMenu()
    const rect = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    if (direction === 'vertical') {
      // Vertikal: atas = sebelumnya, bawah = berikutnya, tengah = menu.
      if (y < 0.33) return onPrev()
      if (y > 0.66) return onNext()
      return onToggleMenu()
    }
    if (x < 0.33) return direction === 'rtl' ? onNext() : onPrev()
    if (x > 0.66) return direction === 'rtl' ? onPrev() : onNext()
    onToggleMenu()
  }

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) {
      touch.current = null // pinch zoom: jangan dianggap swipe
      return
    }
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() }
  }

  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touch.current
    touch.current = null
    // Sedang di-zoom (pinch): geser = menggeser gambar, bukan ganti halaman.
    if (!start || (window.visualViewport?.scale ?? 1) > 1.01) return
    const dx = e.changedTouches[0].clientX - start.x
    const dy = e.changedTouches[0].clientY - start.y
    if (Date.now() - start.t > 800) return
    if (direction === 'vertical') {
      if (Math.abs(dy) < SWIPE_PX || Math.abs(dy) < Math.abs(dx)) return
      markSwiped()
      return dy < 0 ? onNext() : onPrev()
    }
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy)) return
    markSwiped()
    const forward = direction === 'rtl' ? dx > 0 : dx < 0
    return forward ? onNext() : onPrev()
  }

  const isTransition = index >= pages.length

  return (
    <div className={`paged-viewer fit-${fit}`} onClick={handleTap} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {isTransition ? (
        <div className="reader-transition">{transition}</div>
      ) : (
        <PageImage key={pages[index]} src={pages[index]} eager className="paged-page" />
      )}
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'

const THRESHOLD_PX = 72
const MAX_PULL_PX = 110

/**
 * Tarik ke bawah saat scroll di paling atas → `onRefresh`.
 * Kontainer scroll aplikasi adalah #root (lihat index.css).
 * Mengembalikan jarak tarik untuk indikator.
 */
export function usePullToRefresh(onRefresh: () => void, enabled = true): number {
  const [pull, setPull] = useState(0)
  const startY = useRef<number | null>(null)
  const pullRef = useRef(0)
  const callback = useRef(onRefresh)
  useEffect(() => {
    callback.current = onRefresh
  }, [onRefresh])

  useEffect(() => {
    if (!enabled) return
    const root = document.getElementById('root')
    if (!root) return

    const onStart = (e: TouchEvent) => {
      startY.current = root.scrollTop <= 0 ? e.touches[0].clientY : null
    }
    const onMove = (e: TouchEvent) => {
      if (startY.current === null) return
      const dy = e.touches[0].clientY - startY.current
      if (dy <= 0 || root.scrollTop > 0) {
        pullRef.current = 0
        setPull(0)
        return
      }
      pullRef.current = Math.min(MAX_PULL_PX, dy * 0.5)
      setPull(pullRef.current)
    }
    const onEnd = () => {
      if (pullRef.current >= THRESHOLD_PX) callback.current()
      startY.current = null
      pullRef.current = 0
      setPull(0)
    }

    root.addEventListener('touchstart', onStart, { passive: true })
    root.addEventListener('touchmove', onMove, { passive: true })
    root.addEventListener('touchend', onEnd)
    root.addEventListener('touchcancel', onEnd)
    return () => {
      root.removeEventListener('touchstart', onStart)
      root.removeEventListener('touchmove', onMove)
      root.removeEventListener('touchend', onEnd)
      root.removeEventListener('touchcancel', onEnd)
    }
  }, [enabled])

  return pull
}

export function PullIndicator({ distance }: { distance: number }) {
  if (distance <= 0) return null
  const ready = distance >= THRESHOLD_PX
  return (
    <div className="pull-indicator" style={{ height: distance }}>
      <span style={{ transform: `rotate(${distance * 3}deg)`, opacity: ready ? 1 : 0.5 }}>↻</span>
    </div>
  )
}

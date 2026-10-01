import { useRef } from 'react'
import type React from 'react'

const HOLD_MS = 450
const MOVE_TOLERANCE_PX = 10

/**
 * Tekan lama untuk sentuh & mouse. Dibatalkan kalau jari bergeser (sedang menggulir),
 * supaya scroll di iPhone tidak memilih item tanpa sengaja.
 * `onClick` hanya terpanggil kalau bukan tekan lama.
 */
export function useLongPress(onLongPress: () => void, onClick?: () => void) {
  const timer = useRef<number | null>(null)
  const fired = useRef(false)
  const start = useRef<{ x: number; y: number } | null>(null)

  const cancel = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
  }

  const begin = (x: number, y: number) => {
    fired.current = false
    start.current = { x, y }
    cancel()
    timer.current = window.setTimeout(() => {
      fired.current = true
      timer.current = null
      if (navigator.vibrate) navigator.vibrate(15)
      onLongPress()
    }, HOLD_MS)
  }

  const move = (x: number, y: number) => {
    if (!start.current) return
    if (Math.abs(x - start.current.x) > MOVE_TOLERANCE_PX || Math.abs(y - start.current.y) > MOVE_TOLERANCE_PX) {
      cancel()
    }
  }

  return {
    onTouchStart: (e: React.TouchEvent) => begin(e.touches[0].clientX, e.touches[0].clientY),
    onTouchMove: (e: React.TouchEvent) => move(e.touches[0].clientX, e.touches[0].clientY),
    onTouchEnd: cancel,
    onTouchCancel: cancel,
    onMouseDown: (e: React.MouseEvent) => begin(e.clientX, e.clientY),
    onMouseMove: (e: React.MouseEvent) => move(e.clientX, e.clientY),
    onMouseUp: cancel,
    onMouseLeave: cancel,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    onClick: (e: React.MouseEvent) => {
      if (fired.current) {
        e.preventDefault()
        fired.current = false
        return
      }
      if (onClick) {
        e.preventDefault()
        onClick()
      }
    },
  }
}

/*
 * Preload ala Mihon (HttpPageLoader.kt: preloadSize = 4): unduh N gambar berikutnya
 * ke cache HTTP browser supaya ganti halaman terasa instan.
 */

export const PRELOAD_AHEAD = 6
/** Sisa halaman saat chapter berikutnya mulai disiapkan. */
export const NEXT_CHAPTER_THRESHOLD = 3

const inflight = new Map<string, HTMLImageElement>()
const MAX_INFLIGHT = 24

export function preloadImage(url: string) {
  if (inflight.has(url)) return
  if (inflight.size >= MAX_INFLIGHT) {
    const oldest = inflight.keys().next().value
    if (oldest !== undefined) inflight.delete(oldest)
  }
  const img = new Image()
  img.decoding = 'async'
  img.src = url
  inflight.set(url, img)
  const done = () => inflight.delete(url)
  img.onload = done
  img.onerror = done
}

export function preloadAround(pages: string[], index: number, ahead = PRELOAD_AHEAD) {
  for (let i = index + 1; i <= Math.min(pages.length - 1, index + ahead); i++) preloadImage(pages[i])
}

import { serverPath } from './base'
import { COVER_FALLBACK } from '../coverFallback'
import type { MangaItem } from './library'

/** Daftar URL cover (thumbnail utama + pengganti) untuk sekumpulan manga. */
export function collectCoverUrls(mangas: MangaItem[]): string[] {
  const urls: string[] = []
  for (const m of mangas) {
    if (m.thumbnailUrl) urls.push(serverPath(m.thumbnailUrl))
    const fb = COVER_FALLBACK[m.id]
    if (fb) urls.push(serverPath(fb))
  }
  return urls
}

export interface WarmProgress {
  done: number
  total: number
  failed: number
  bytes: number
}

export interface WarmOptions {
  /** Dipanggil tiap batas batch; true = berhenti (tombol Batal). */
  isCancelled?: () => boolean
  /** Sinyal abort global: membatalkan fetch yang sedang berjalan seketika. */
  signal?: AbortSignal
}

/**
 * Isi cache perangkat untuk cover yang belum tersimpan (saja).
 * Yang sudah di-cache = cache-hit tanpa jaringan. Unduhan 6 bersamaan;
 * gagal = dilewati (dicoba lagi saat cover itu dibuka). Mengonsumsi body
 * supaya unduhan tuntas walau service worker sedang diperbarui.
 * Sengaja tetap jalan walau pengguna pindah halaman. Berhenti hanya bila
 * isCancelled() true / signal abort (tombol Batal) atau halaman ditutup
 * (JS ikut berhenti). Tiap fetch dibatasi 30 detik supaya satu cover yang
 * menggantung tidak memblokir antrean (dan tidak menunda Batal) selamanya.
 */
export async function warmCovers(
  urls: string[],
  onProgress?: (p: WarmProgress) => void,
  options?: WarmOptions,
): Promise<WarmProgress & { cancelled: boolean }> {
  const progress: WarmProgress = { done: 0, total: urls.length, failed: 0, bytes: 0 }
  const isCancelled = options?.isCancelled
  const signal = options?.signal
  const cancelled = () => (isCancelled?.() ?? false) || (signal?.aborted ?? false)
  if (typeof caches === 'undefined') return { ...progress, cancelled: false }
  const missing: string[] = []
  for (const u of urls) {
    if (cancelled()) break
    try {
      const hit = await caches.match(u, { ignoreSearch: true })
      if (!hit) missing.push(u)
    } catch {
      missing.push(u)
    }
  }
  progress.total = urls.length
  // Yang sudah di-cache dihitung selesai sejak awal (tanpa unduhan).
  progress.done = urls.length - missing.length
  const report = () => onProgress?.({ ...progress })
  report()
  for (let i = 0; i < missing.length; i += 6) {
    if (cancelled()) break
    await Promise.all(
      missing.slice(i, i + 6).map(async (u) => {
        // Timeout 30 detik per cover + abort instan saat Batal ditekan.
        const ctrl = new AbortController()
        const timer = setTimeout(() => ctrl.abort(), 30000)
        if (signal) {
          if (signal.aborted) ctrl.abort()
          else signal.addEventListener('abort', () => ctrl.abort(), { once: true })
        }
        try {
          const res = await fetch(u, { signal: ctrl.signal })
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const blob = await res.blob()
          progress.bytes += blob.size
          progress.done += 1
        } catch {
          // Dibatalkan (bukan gagal): tidak dihitung gagal maupun selesai.
          if (ctrl.signal.aborted && cancelled()) return
          progress.failed += 1
          progress.done += 1
        } finally {
          clearTimeout(timer)
          report()
        }
      }),
    )
  }
  report()
  return { ...progress, cancelled: cancelled() }
}

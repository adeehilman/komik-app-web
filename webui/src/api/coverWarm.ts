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

/**
 * Isi cache perangkat untuk cover yang belum tersimpan (saja).
 * Yang sudah di-cache = cache-hit tanpa jaringan. Unduhan 6 bersamaan;
 * gagal = dilewati (dicoba lagi saat cover itu dibuka). Mengonsumsi body
 * supaya unduhan tuntas walau service worker sedang diperbarui.
 * Sengaja tanpa AbortController: tetap jalan sampai selesai walau pengguna
 * pindah halaman. Berhenti hanya bila isCancelled() true (tombol Batal)
 * atau halaman ditutup (JS ikut berhenti).
 */
export async function warmCovers(
  urls: string[],
  onProgress?: (p: WarmProgress) => void,
  isCancelled?: () => boolean,
): Promise<WarmProgress & { cancelled: boolean }> {
  const progress: WarmProgress = { done: 0, total: urls.length, failed: 0, bytes: 0 }
  const cancelled = () => isCancelled?.() ?? false
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
        try {
          const res = await fetch(u)
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const blob = await res.blob()
          progress.bytes += blob.size
        } catch {
          progress.failed += 1
        } finally {
          progress.done += 1
          report()
        }
      }),
    )
  }
  report()
  return { ...progress, cancelled: cancelled() }
}

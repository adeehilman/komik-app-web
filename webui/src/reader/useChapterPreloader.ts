import { useEffect, useState } from 'react'

/*
 * Muat seluruh halaman chapter di belakang layar (W-16). Urutan: mulai dari `startIndex` sampai akhir, lalu
 * halaman sebelumnya; 3 sekaligus; tiap halaman dicoba ulang. Gambar masuk cache service worker (W-15), jadi
 * <img> mengambilnya instan dan halaman yang sudah termuat tetap ada walau jaringan putus.
 */
const CONCURRENCY = 3
const RETRY_DELAYS_MS = [1000, 3000, 8000]

export interface PreloadProgress {
  loaded: number
  failed: number
  total: number
}

export function useChapterPreloader(pages: string[], startIndex: number, enabled: boolean): PreloadProgress {
  const [progress, setProgress] = useState<PreloadProgress>({ loaded: 0, failed: 0, total: 0 })

  useEffect(() => {
    if (!enabled || pages.length === 0) return
    const controller = new AbortController()
    const done = new Set<number>()
    const failed = new Set<number>()
    const total = pages.length
    const distance = (i: number) => (i >= startIndex ? i - startIndex : total + i)
    const queue = [...pages.keys()].sort((a, b) => distance(a) - distance(b))
    let cursor = 0
    let running = 0

    const report = () => {
      if (!controller.signal.aborted) setProgress({ loaded: done.size, failed: failed.size, total })
    }
    const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

    const loadOne = async (i: number) => {
      for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
        if (controller.signal.aborted) return
        try {
          const res = await fetch(pages[i], { signal: controller.signal })
          if (res.ok) {
            await res.blob() // tunggu seluruh gambar diterima (dan tersimpan di cache)
            done.add(i)
            failed.delete(i)
            report()
            return
          }
        } catch {
          if (controller.signal.aborted) return
        }
        if (attempt < RETRY_DELAYS_MS.length) await sleep(RETRY_DELAYS_MS[attempt])
      }
      failed.add(i)
      report()
    }

    const worker = async () => {
      running++
      while (!controller.signal.aborted && cursor < queue.length) {
        const i = queue[cursor++]
        if (!done.has(i)) await loadOne(i)
      }
      running--
    }

    const start = () => {
      for (let w = running; w < CONCURRENCY; w++) void worker()
    }

    // Jaringan kembali: antrekan ulang halaman yang gagal.
    const onOnline = () => {
      if (failed.size === 0) return
      queue.push(...failed)
      failed.clear()
      report()
      start()
    }

    report()
    start()
    window.addEventListener('online', onOnline)
    return () => {
      controller.abort()
      window.removeEventListener('online', onOnline)
    }
  }, [pages, startIndex, enabled])

  return progress
}

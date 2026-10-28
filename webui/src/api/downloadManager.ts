import { useSyncExternalStore } from 'react'
import { fetchLibrary } from './library'
import { collectCoverUrls, warmCovers } from './coverWarm'

/**
 * Manajer unduhan cover tingkat aplikasi (bukan komponen).
 *
 * Sengaja di luar komponen supaya unduhan TIDAK ikut mati saat pengguna
 * pindah halaman: navigasi di aplikasi ini tidak memuat ulang halaman,
 * jadi state modul tetap hidup dan unduhan terus jalan di latar.
 * Berhenti hanya bila: tombol Batal ditekan, atau halaman/tab ditutup
 * (saat itu JS berhenti total — tidak ada kode yang bisa jalan tanpa
 * halaman; tapi cover yang sudah tersimpan tetap tersimpan, dan ketuk
 * Unduh lagi akan melanjutkan dari sisanya, bukan dari nol).
 */

export type DownloadStatus = 'idle' | 'running' | 'done' | 'cancelled'

export interface DownloadState {
  status: DownloadStatus
  done: number
  total: number
  failed: number
  bytes: number
  error: string | null
}

const initial: DownloadState = {
  status: 'idle',
  done: 0,
  total: 0,
  failed: 0,
  bytes: 0,
  error: null,
}

let state: DownloadState = initial
let cancelFlag = false
let abortCtrl: AbortController | null = null
const listeners = new Set<() => void>()

function setState(next: DownloadState) {
  state = next
  listeners.forEach((l) => l())
}

export function subscribeDownload(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function getDownloadState(): DownloadState {
  return state
}

/** Mulai/lanjutkan unduhan. Bila sudah berjalan, tidak melakukan apa-apa. */
export async function startDownload(): Promise<void> {
  if (state.status === 'running') return
  cancelFlag = false
  abortCtrl = new AbortController()
  const signal = abortCtrl.signal
  setState({ ...initial, status: 'running' })
  try {
    const { mangas } = await fetchLibrary()
    const urls = collectCoverUrls(mangas)
    setState({ ...state, total: urls.length })
    const summary = await warmCovers(
      urls,
      (p) => {
        setState({ ...state, done: p.done, total: p.total, failed: p.failed, bytes: p.bytes })
      },
      { isCancelled: () => cancelFlag, signal },
    )
    setState({
      status: summary.cancelled ? 'cancelled' : 'done',
      done: summary.done,
      total: summary.total,
      failed: summary.failed,
      bytes: summary.bytes,
      error: null,
    })
  } catch {
    setState({ ...state, status: 'idle', error: 'Gagal memulai unduhan — coba lagi.' })
  }
}

/** Berhenti seketika: batalkan fetch yang sedang berjalan + set flag. */
export function cancelDownload(): void {
  cancelFlag = true
  abortCtrl?.abort()
}

/** Hook komponen untuk membaca state manajer secara live. */
export function useDownloadState(): DownloadState {
  return useSyncExternalStore(subscribeDownload, getDownloadState)
}

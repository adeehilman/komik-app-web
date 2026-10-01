import { useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchLibraryUpdateStatus, startLibraryUpdate, stopLibraryUpdate } from '../api/updates'
import type { LibraryUpdateJobs } from '../api/updates'
import { Icon } from './Icon'

const STATUS_KEY = ['libraryUpdateStatus']

/**
 * Status update library di server. Polling tiap 2 detik HANYA selama berjalan
 * (tanpa WebSocket — .agents/features/auto-update.md). Saat selesai: Library, Updates, badge di-refresh.
 */
export function useLibraryUpdate() {
  const queryClient = useQueryClient()
  const { data } = useQuery({
    queryKey: STATUS_KEY,
    queryFn: fetchLibraryUpdateStatus,
    refetchInterval: (query) => (query.state.data?.isRunning ? 2000 : false),
    staleTime: 0,
  })

  const wasRunning = useRef(false)
  useEffect(() => {
    const running = !!data?.isRunning
    if (wasRunning.current && !running) {
      queryClient.invalidateQueries({ queryKey: ['library'] })
      queryClient.invalidateQueries({ queryKey: ['updates'] })
      queryClient.invalidateQueries({ queryKey: ['newChapterCount'] })
    }
    wasRunning.current = running
  }, [data?.isRunning, queryClient])

  const start = async (categoryIds?: number[]) => {
    // Optimistis: tampilkan progres langsung, polling mulai sendiri.
    queryClient.setQueryData<LibraryUpdateJobs>(STATUS_KEY, { isRunning: true, totalJobs: 0, finishedJobs: 0 })
    try {
      await startLibraryUpdate(categoryIds)
    } finally {
      queryClient.invalidateQueries({ queryKey: STATUS_KEY })
    }
  }

  const stop = async () => {
    await stopLibraryUpdate()
    queryClient.invalidateQueries({ queryKey: STATUS_KEY })
  }

  return { status: data, start, stop }
}

/** Bar tipis di bawah top bar + teks "Memperbarui 3/20" + tombol batal. */
export function LibraryUpdateBar({ status, onStop }: { status?: LibraryUpdateJobs; onStop: () => void }) {
  if (!status?.isRunning) return null
  const { totalJobs, finishedJobs } = status
  const percent = totalJobs > 0 ? (finishedJobs / totalJobs) * 100 : 0
  return (
    <div className="update-bar">
      <div className={`progress-bar ${totalJobs === 0 ? 'indeterminate' : ''}`}>
        <div className="progress-bar-fill" style={totalJobs > 0 ? { width: `${percent}%` } : undefined} />
      </div>
      <div className="update-bar-text">
        <span>{totalJobs > 0 ? `Memperbarui ${finishedJobs}/${totalJobs}` : 'Memulai update…'}</span>
        <button type="button" className="btn btn-text" onClick={onStop}>
          <Icon name="close" size={18} /> Batal
        </button>
      </div>
    </div>
  )
}

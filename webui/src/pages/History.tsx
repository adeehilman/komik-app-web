import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { fetchHistory } from '../api/history'
import { toNumber } from '../api/client'
import { TopBar } from '../components/TopBar'
import { Icon } from '../components/Icon'
import { EntryRow, groupByDay } from '../components/EntryRow'

export function HistoryPage() {
  const navigate = useNavigate()
  const [searching, setSearching] = useState(false)
  const [search, setSearch] = useState('')
  const { data, isLoading, error } = useQuery({ queryKey: ['history'], queryFn: () => fetchHistory() })

  const q = search.trim().toLowerCase()
  const items = (data ?? []).filter((c) => !q || c.manga.title.toLowerCase().includes(q))
  // lastReadAt dalam detik, sama seperti fetchedAt.
  const groups = groupByDay(items, (c) => toNumber(c.lastReadAt) * 1000)

  return (
    <div>
      <TopBar
        title="History"
        actions={
          <button type="button" className="icon-btn" aria-label="Cari" onClick={() => setSearching(true)}>
            <Icon name="search" />
          </button>
        }
      >
        {searching ? (
          <>
            <input
              className="top-bar-search"
              autoFocus
              placeholder="Cari riwayat…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button
              type="button"
              className="icon-btn"
              aria-label="Tutup pencarian"
              onClick={() => {
                setSearching(false)
                setSearch('')
              }}
            >
              <Icon name="close" />
            </button>
          </>
        ) : undefined}
      </TopBar>

      {isLoading && <div className="spinner" />}
      {error && <div className="error-text">{(error as Error).message}</div>}
      {data && items.length === 0 && (
        <div className="empty-state">
          <span className="empty-face">(･o･;)</span>
          <span>Belum ada riwayat baca</span>
        </div>
      )}

      {groups.map(([label, chapters]) => (
        <section key={label}>
          <div className="section-title">{label}</div>
          {chapters.map((c) => {
            const time = new Date(toNumber(c.lastReadAt) * 1000).toLocaleTimeString('id-ID', {
              hour: '2-digit',
              minute: '2-digit',
            })
            const page = !c.isRead && c.lastPageRead > 0 ? ` • Hal. ${c.lastPageRead + 1}` : ''
            return (
              <EntryRow
                key={c.id}
                mangaId={c.mangaId}
                thumbnailUrl={c.manga.thumbnailUrl}
                title={c.manga.title}
                subtitle={`${c.name}${page} • ${time}`}
                to={`/reader/${c.id}`}
                action={
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="Lanjut baca"
                    onClick={() => navigate(`/reader/${c.id}`)}
                  >
                    <Icon name="play" />
                  </button>
                }
              />
            )
          })}
        </section>
      ))}
    </div>
  )
}

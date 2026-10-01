import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import './EntryRow.css'

/** Baris Updates/History: cover kecil (ke detail manga) + teks (ke reader) + aksi di kanan. */
export function EntryRow({
  mangaId,
  thumbnailUrl,
  title,
  subtitle,
  to,
  dimmed,
  action,
}: {
  mangaId: number
  thumbnailUrl: string | null
  title: ReactNode
  subtitle: ReactNode
  to: string
  dimmed?: boolean
  action?: ReactNode
}) {
  return (
    <div className={`entry-row ${dimmed ? 'dimmed' : ''}`}>
      <Link to={`/manga/${mangaId}`} className="entry-cover">
        {thumbnailUrl && (
          <img src={thumbnailUrl} alt="" loading="lazy" onError={(e) => (e.currentTarget.style.visibility = 'hidden')} />
        )}
      </Link>
      <Link to={to} className="entry-text">
        <span className="entry-title">{title}</span>
        <span className="entry-subtitle">{subtitle}</span>
      </Link>
      {action}
    </div>
  )
}

/** Kelompokkan berdasarkan hari: "Hari ini", "Kemarin", atau tanggal. */
export function dayLabel(ms: number): string {
  const d = new Date(ms)
  const today = new Date()
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diffDays = Math.round((startOf(today) - startOf(d)) / 86_400_000)
  if (diffDays === 0) return 'Hari ini'
  if (diffDays === 1) return 'Kemarin'
  if (diffDays < 7) return `${diffDays} hari lalu`
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function groupByDay<T>(items: T[], timeMs: (item: T) => number): Array<[string, T[]]> {
  const groups: Array<[string, T[]]> = []
  for (const item of items) {
    const label = dayLabel(timeMs(item))
    const last = groups[groups.length - 1]
    if (last && last[0] === label) last[1].push(item)
    else groups.push([label, [item]])
  }
  return groups
}

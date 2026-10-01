import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from './Icon'
import { useLongPress } from './useLongPress'
import './MangaCard.css'

export type DisplayMode = 'compact' | 'comfortable' | 'cover_only' | 'list'

export interface CardManga {
  id: number
  title: string
  thumbnailUrl: string | null
}

interface MangaCardProps {
  manga: CardManga
  displayMode: DisplayMode
  badges?: ReactNode
  /** Tampilkan tombol "continue reading" yang membuka chapter ini. */
  continueChapterId?: number
  /** Redupkan cover (mis. sudah ada di library saat browse). */
  dimmed?: boolean
  selected?: boolean
  selectionMode?: boolean
  onToggleSelect?: (id: number) => void
}

export function MangaCard({
  manga,
  displayMode,
  badges,
  continueChapterId,
  dimmed,
  selected,
  selectionMode,
  onToggleSelect,
}: MangaCardProps) {
  const navigate = useNavigate()
  const press = useLongPress(
    () => onToggleSelect?.(manga.id),
    () => (selectionMode ? onToggleSelect?.(manga.id) : navigate(`/manga/${manga.id}`)),
  )

  const cover = (
    <div className={`card-cover ${dimmed ? 'dimmed' : ''}`}>
      {manga.thumbnailUrl ? (
        <img
          src={manga.thumbnailUrl}
          alt=""
          loading="lazy"
          decoding="async"
          // CDN source kadang 404/522 → tampilkan placeholder abu-abu, bukan ikon gambar rusak.
          onError={(e) => (e.currentTarget.style.visibility = 'hidden')}
        />
      ) : (
        <div className="card-cover-placeholder" />
      )}
      {badges && displayMode !== 'list' && <div className="card-badges">{badges}</div>}
      {displayMode === 'compact' && (
        <div className="card-compact-title">
          <span>{manga.title}</span>
        </div>
      )}
      {continueChapterId !== undefined && !selectionMode && (
        <button
          type="button"
          className="card-continue"
          aria-label="Lanjut baca"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            navigate(`/reader/${continueChapterId}`)
          }}
          onTouchStart={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <Icon name="play" size={18} />
        </button>
      )}
    </div>
  )

  return (
    <a
      href={`#/manga/${manga.id}`}
      className={`card card-${displayMode} ${selected ? 'selected' : ''}`}
      {...press}
    >
      {cover}
      {displayMode === 'comfortable' && <span className="card-title">{manga.title}</span>}
      {displayMode === 'list' && <span className="card-list-title">{manga.title}</span>}
      {displayMode === 'list' && badges && <div className="card-badges">{badges}</div>}
    </a>
  )
}

export function MangaGrid({
  displayMode,
  columns,
  children,
}: {
  displayMode: DisplayMode
  /** 0 = otomatis dari lebar layar. */
  columns: number
  children: ReactNode
}) {
  if (displayMode === 'list') return <div className="manga-list">{children}</div>
  const style = columns > 0 ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined
  return (
    <div className="manga-grid" style={style}>
      {children}
    </div>
  )
}

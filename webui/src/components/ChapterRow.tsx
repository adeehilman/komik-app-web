import { useNavigate } from 'react-router-dom'
import type { ChapterItem } from '../api/chapter'
import { toNumber } from '../api/client'
import { Icon } from './Icon'
import { useLongPress } from './useLongPress'

export function formatDate(ms: number): string {
  if (!ms) return ''
  return new Date(ms).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

interface ChapterRowProps {
  chapter: ChapterItem
  selected: boolean
  selectionMode: boolean
  onToggleSelect: (id: number) => void
  onDownload: (id: number) => void
}

export function ChapterRow({ chapter, selected, selectionMode, onToggleSelect, onDownload }: ChapterRowProps) {
  const navigate = useNavigate()
  const press = useLongPress(
    () => onToggleSelect(chapter.id),
    () => (selectionMode ? onToggleSelect(chapter.id) : navigate(`/reader/${chapter.id}`)),
  )
  const progress = !chapter.isRead && chapter.lastPageRead > 0 ? `Halaman ${chapter.lastPageRead + 1}` : null
  const meta = [formatDate(toNumber(chapter.uploadDate)), progress, chapter.scanlator].filter(Boolean).join(' • ')

  return (
    <div className={`chapter-row ${chapter.isRead ? 'read' : ''} ${selected ? 'selected' : ''}`} {...press}>
      <div className="chapter-text">
        <span className="chapter-name">
          {chapter.isBookmarked && (
            <span className="chapter-bookmark">
              <Icon name="bookmark" size={16} />
            </span>
          )}
          {chapter.name}
        </span>
        {meta && <span className="chapter-meta">{meta}</span>}
      </div>
      <button
        type="button"
        className={`icon-btn ${chapter.isDownloaded ? 'active' : ''}`}
        aria-label={chapter.isDownloaded ? 'Sudah diunduh' : 'Unduh'}
        disabled={chapter.isDownloaded}
        onClick={(e) => {
          e.stopPropagation()
          onDownload(chapter.id)
        }}
        onTouchStart={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <Icon name={chapter.isDownloaded ? 'downloaded' : 'download'} size={22} />
      </button>
    </div>
  )
}

import { useNavigate } from 'react-router-dom'
import type { ChapterItem } from '../api/chapter'
import { toNumber } from '../api/client'
import { Icon } from './Icon'
import { useLongPress } from './useLongPress'

/**
 * Tanggal relatif untuk seminggu terakhir (perbandingan hari kalender lokal,
 * bukan selisih 24 jam): hari ini -> Today, kemarin -> Yesterday,
 * 2-7 hari lalu -> "N days ago". Lebih dari seminggu atau tanggal di masa
 * depan -> tanggal absolut seperti sebelumnya ("27 Okt 2026").
 */
export function formatDate(ms: number): string {
  if (!ms) return ''
  const date = new Date(ms)
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const diffDays = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays > 1 && diffDays <= 7) return `${diffDays} days ago`
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
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

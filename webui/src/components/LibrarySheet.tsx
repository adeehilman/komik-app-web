import { useState } from 'react'
import { Sheet } from './Sheet'
import { Icon } from './Icon'
import { useSetting } from '../settings/useSetting'
import type { SettingKey, SettingsSchema } from '../settings/schema'

type TriState = 'any' | 'only' | 'exclude'
type FilterKey = Extract<SettingKey, `mihonweb_library_filter_${string}`>
type BoolKey =
  | 'mihonweb_library_badge_unread'
  | 'mihonweb_library_badge_downloaded'
  | 'mihonweb_library_badge_language'
  | 'mihonweb_library_continue_button'
  | 'mihonweb_library_category_tabs'
  | 'mihonweb_library_category_count'

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: 'mihonweb_library_filter_downloaded', label: 'Downloaded' },
  { key: 'mihonweb_library_filter_unread', label: 'Unread' },
  { key: 'mihonweb_library_filter_started', label: 'Started' },
  { key: 'mihonweb_library_filter_bookmarked', label: 'Bookmarked' },
  { key: 'mihonweb_library_filter_completed', label: 'Completed' },
]

const SORTS: Array<{ key: SettingsSchema['mihonweb_library_sort']; label: string }> = [
  { key: 'alpha', label: 'Alphabetically' },
  { key: 'total_chapters', label: 'Total chapters' },
  { key: 'last_read', label: 'Last read' },
  { key: 'last_update', label: 'Last update check' },
  { key: 'unread', label: 'Unread count' },
  { key: 'latest_chapter', label: 'Latest chapter' },
  { key: 'date_added', label: 'Date added' },
  { key: 'random', label: 'Random' },
]

const DISPLAY_MODES: Array<{ key: SettingsSchema['mihonweb_library_display']; label: string }> = [
  { key: 'compact', label: 'Compact grid' },
  { key: 'comfortable', label: 'Comfortable grid' },
  { key: 'cover_only', label: 'Cover-only grid' },
  { key: 'list', label: 'List' },
]

const NEXT: Record<TriState, TriState> = { any: 'only', only: 'exclude', exclude: 'any' }

function TriStateRow({ settingKey, label }: { settingKey: FilterKey; label: string }) {
  const [value, setValue] = useSetting(settingKey)
  return (
    <button type="button" className="list-item" onClick={() => setValue(NEXT[value])}>
      <span className={`tristate tristate-${value}`}>
        {value === 'only' && <Icon name="check" size={18} />}
        {value === 'exclude' && <Icon name="close" size={18} />}
      </span>
      <span className="list-item-title">{label}</span>
    </button>
  )
}

function CheckRow({ settingKey, label }: { settingKey: BoolKey; label: string }) {
  const [value, setValue] = useSetting(settingKey)
  return (
    <label className="list-item">
      <input type="checkbox" checked={value} onChange={(e) => setValue(e.target.checked)} />
      <span className="list-item-title">{label}</span>
    </label>
  )
}

function ColumnsRow({
  settingKey,
  label,
  max,
}: {
  settingKey: 'mihonweb_library_columns_portrait' | 'mihonweb_library_columns_landscape'
  label: string
  max: number
}) {
  const [value, setValue] = useSetting(settingKey)
  return (
    <label className="list-item">
      <span className="list-item-text">
        <span className="list-item-title">{label}</span>
        <span className="list-item-subtitle">{value === 0 ? 'Otomatis' : `${value} kolom`}</span>
      </span>
      <input
        type="range"
        min={0}
        max={max}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        className="range"
      />
    </label>
  )
}

export function LibrarySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<'filter' | 'sort' | 'display'>('filter')
  const [sort, setSort] = useSetting('mihonweb_library_sort')
  const [sortDir, setSortDir] = useSetting('mihonweb_library_sort_dir')
  const [seed, setSeed] = useSetting('mihonweb_library_random_seed')
  const [display, setDisplay] = useSetting('mihonweb_library_display')

  const pickSort = (key: SettingsSchema['mihonweb_library_sort']) => {
    if (key === 'random') {
      // Pilih "Random" lagi = acak ulang (seperti Mihon).
      if (sort !== 'random') setSort('random')
      setSeed((seed % 100000) + 1 + Math.floor(Math.random() * 1000))
      return
    }
    if (key === sort) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else {
      setSort(key)
      setSortDir(key === 'alpha' ? 'asc' : 'desc')
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      header={
        <div className="tabs">
          {(['filter', 'sort', 'display'] as const).map((t) => (
            <button key={t} type="button" className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
              {t === 'filter' ? 'Filter' : t === 'sort' ? 'Sort' : 'Display'}
            </button>
          ))}
        </div>
      }
    >
      {tab === 'filter' && FILTERS.map((f) => <TriStateRow key={f.key} settingKey={f.key} label={f.label} />)}

      {tab === 'sort' &&
        SORTS.map((s) => (
          <button key={s.key} type="button" className="list-item" onClick={() => pickSort(s.key)}>
            <span className="sort-arrow">
              {sort === s.key && (s.key === 'random' ? <Icon name="refresh" size={20} /> : sortDir === 'asc' ? '↑' : '↓')}
            </span>
            <span className="list-item-title">{s.label}</span>
          </button>
        ))}

      {tab === 'display' && (
        <>
          <div className="section-title">Display mode</div>
          <div className="chip-row wrap">
            {DISPLAY_MODES.map((m) => (
              <button
                key={m.key}
                type="button"
                className={`chip ${display === m.key ? 'active' : ''}`}
                onClick={() => setDisplay(m.key)}
              >
                {m.label}
              </button>
            ))}
          </div>
          {display !== 'list' && (
            <>
              <ColumnsRow settingKey="mihonweb_library_columns_portrait" label="Kolom (portrait)" max={6} />
              <ColumnsRow settingKey="mihonweb_library_columns_landscape" label="Kolom (landscape)" max={10} />
            </>
          )}
          <div className="section-title">Badges</div>
          <CheckRow settingKey="mihonweb_library_badge_downloaded" label="Downloaded chapters" />
          <CheckRow settingKey="mihonweb_library_badge_unread" label="Unread chapters" />
          <CheckRow settingKey="mihonweb_library_badge_language" label="Language" />
          <div className="section-title">Tabs</div>
          <CheckRow settingKey="mihonweb_library_category_tabs" label="Show category tabs" />
          <CheckRow settingKey="mihonweb_library_category_count" label="Show number of items" />
          <div className="section-title">Other</div>
          <CheckRow settingKey="mihonweb_library_continue_button" label="Show continue reading button" />
        </>
      )}
    </Sheet>
  )
}

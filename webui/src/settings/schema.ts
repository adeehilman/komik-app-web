export interface SettingsSchema {
  mihonweb_reader_mode: 'ltr' | 'rtl' | 'vertical' | 'webtoon'
  mihonweb_reader_tap_zones: boolean
  mihonweb_reader_fit: 'width' | 'height' | 'screen'
  mihonweb_reader_bg: 'black' | 'gray' | 'white'
  mihonweb_reader_webtoon_gap: number
  mihonweb_library_display: 'compact' | 'comfortable' | 'cover_only' | 'list'
  mihonweb_library_columns_portrait: number
  mihonweb_library_columns_landscape: number
  mihonweb_library_sort: 'alpha' | 'last_read' | 'last_update' | 'unread' | 'total_chapters' | 'latest_chapter' | 'date_added' | 'random'
  mihonweb_library_sort_dir: 'asc' | 'desc'
  mihonweb_library_filter_downloaded: 'any' | 'only' | 'exclude'
  mihonweb_library_filter_unread: 'any' | 'only' | 'exclude'
  mihonweb_library_filter_started: 'any' | 'only' | 'exclude'
  mihonweb_library_filter_bookmarked: 'any' | 'only' | 'exclude'
  mihonweb_library_filter_completed: 'any' | 'only' | 'exclude'
  mihonweb_library_badge_unread: boolean
  mihonweb_library_badge_downloaded: boolean
  mihonweb_library_badge_language: boolean
  mihonweb_library_continue_button: boolean
  mihonweb_library_category_tabs: boolean
  mihonweb_library_category_count: boolean
  mihonweb_library_last_category: number
  // Tambahan 2026-10-01 (lihat .agents/nodes/settings.md):
  mihonweb_library_random_seed: number // urutan "random" stabil sampai diacak ulang (W-04b)
  mihonweb_browse_langs: string // bahasa extension yang ditampilkan, dipisah koma (W-05)
  mihonweb_updates_last_seen: number // detik epoch; badge chapter baru di tab Updates (W-12)
}

export type SettingKey = keyof SettingsSchema

export const SETTINGS_DEFAULTS: SettingsSchema = {
  mihonweb_reader_mode: 'rtl',
  mihonweb_reader_tap_zones: true,
  mihonweb_reader_fit: 'screen',
  mihonweb_reader_bg: 'black',
  mihonweb_reader_webtoon_gap: 0,
  mihonweb_library_display: 'compact',
  mihonweb_library_columns_portrait: 0,
  mihonweb_library_columns_landscape: 0,
  mihonweb_library_sort: 'alpha',
  mihonweb_library_sort_dir: 'asc',
  mihonweb_library_filter_downloaded: 'any',
  mihonweb_library_filter_unread: 'any',
  mihonweb_library_filter_started: 'any',
  mihonweb_library_filter_bookmarked: 'any',
  mihonweb_library_filter_completed: 'any',
  mihonweb_library_badge_unread: true,
  mihonweb_library_badge_downloaded: false,
  mihonweb_library_badge_language: false,
  mihonweb_library_continue_button: false,
  mihonweb_library_category_tabs: true,
  mihonweb_library_category_count: false,
  mihonweb_library_last_category: 0,
  mihonweb_library_random_seed: 1,
  mihonweb_browse_langs: 'all,id,en',
  mihonweb_updates_last_seen: 0,
}

export const META_PREFIX = 'mihonweb_'

export function parseSettingValue<K extends SettingKey>(key: K, rawValue: string | null | undefined): SettingsSchema[K] {
  if (rawValue === null || rawValue === undefined) {
    return SETTINGS_DEFAULTS[key]
  }

  const def = SETTINGS_DEFAULTS[key]
  if (typeof def === 'boolean') {
    return (rawValue === 'true') as SettingsSchema[K]
  }
  if (typeof def === 'number') {
    const num = Number(rawValue)
    return (isNaN(num) ? def : num) as SettingsSchema[K]
  }
  return rawValue as SettingsSchema[K]
}

export function serializeSettingValue<K extends SettingKey>(value: SettingsSchema[K]): string {
  return String(value)
}

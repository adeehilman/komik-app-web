# Node: Setelan WebUI (server meta)

**File:** `webui/src/settings/schema.ts`, `webui/src/settings/useSetting.ts`

## Model penyimpanan (decisions D-07)

```
UI ─ useSetting(key) ─▶ cache TanStack ['globalMeta']  ◀─ metas(filter:{key:{startsWith:"mihonweb_"}})
                         │ optimistis                       (SATU query untuk semua key)
                         ├─▶ localStorage 'mihonweb_meta_cache' (cache baca-cepat, placeholderData)
                         └─▶ setGlobalMeta(input:{meta:{key,value}})  → gagal = rollback
```

- Semua nilai disimpan sebagai **string**; `parseSettingValue` mengubah ke boolean/number/enum berdasarkan
  tipe default. Key tanpa nilai di server = default dari `SETTINGS_DEFAULTS`.
- Semua komponen yang memakai key yang sama otomatis sinkron (cache bersama).
- Meta = "client data" di backup `.tachibk` → setelan ikut backup/restore.
- Prefix `mihonweb_` mencegah bentrok dengan WebUI resmi (`webUI_*`).

## Override per manga — `useMangaSetting(mangaId, key)`

Mengembalikan `{ value, isOverride, setGlobal, setForManga, clearOverride }`.
Sumber: `manga(id){ meta { key value } }` (query key `['mangaMeta', mangaId]`).
`setForManga` → `setMangaMeta`; `clearOverride` → `deleteMangaMeta` (kembali ikut global).
Saat ini hanya dipakai untuk `mihonweb_reader_mode` (Reader: "Berlaku untuk judul ini saja").

## Daftar key

| Key | Nilai | Default | Padanan Mihon / fungsi |
|---|---|---|---|
| `mihonweb_reader_mode` | `ltr` `rtl` `vertical` `webtoon` | `rtl` | `ReadingMode` (bisa per manga) |
| `mihonweb_reader_tap_zones` | bool | `true` | navigasi tap |
| `mihonweb_reader_fit` | `width` `height` `screen` | `screen` | scale type (mode paged) |
| `mihonweb_reader_bg` | `black` `gray` `white` | `black` | warna latar reader |
| `mihonweb_reader_webtoon_gap` | 0–32 (px, langkah 4) | `0` | padding webtoon |
| `mihonweb_library_display` | `compact` `comfortable` `cover_only` `list` | `compact` | `LibraryDisplayMode` |
| `mihonweb_library_columns_portrait` | 0 (otomatis)–6 | `0` | `portraitColumns` |
| `mihonweb_library_columns_landscape` | 0 (otomatis)–10 | `0` | `landscapeColumns` |
| `mihonweb_library_sort` | `alpha` `last_read` `last_update` `unread` `total_chapters` `latest_chapter` `date_added` `random` | `alpha` | `LibrarySortMode` |
| `mihonweb_library_sort_dir` | `asc` `desc` | `asc` | arah sort |
| `mihonweb_library_filter_downloaded` | `any` `only` `exclude` | `any` | `filterDownloaded` |
| `mihonweb_library_filter_unread` | sama | `any` | `filterUnread` |
| `mihonweb_library_filter_started` | sama | `any` | `filterStarted` |
| `mihonweb_library_filter_bookmarked` | sama | `any` | `filterBookmarked` |
| `mihonweb_library_filter_completed` | sama | `any` | `filterCompleted` |
| `mihonweb_library_badge_unread` | bool | `true` | `unreadBadge` |
| `mihonweb_library_badge_downloaded` | bool | `false` | `downloadBadge` |
| `mihonweb_library_badge_language` | bool | `false` | `languageBadge` |
| `mihonweb_library_continue_button` | bool | `false` | `showContinueReadingButton` |
| `mihonweb_library_category_tabs` | bool | `true` | `categoryTabs` |
| `mihonweb_library_category_count` | bool | `false` | `categoryNumberOfItems` |
| `mihonweb_library_last_category` | id kategori | `0` | `lastUsedCategory` |
| `mihonweb_library_random_seed` | angka | `1` | urutan "random" stabil sampai diacak ulang |
| `mihonweb_browse_langs` | kode bahasa dipisah koma | `all,id,en` | filter bahasa daftar extension |
| `mihonweb_updates_last_seen` | detik epoch | `0` | badge Updates; `0` = badge mati sampai tab Updates dibuka |

Nama & default kolom Mihon diambil dari `LibraryPreferences.kt`, `LibraryDisplayMode.kt`, `LibrarySortMode.kt`
(Mihon, Apache-2.0). Sort Mihon `TrackerMean` dan `ChapterFetchDate` sengaja tidak diambil.

## Setelan server (bukan meta)

Interval update otomatis, exclude, auto-download → `settings` / `setSettings` di server
(`features/auto-update.md`). Jangan diduplikasi ke meta.

## Menambah setelan

1. Tambah ke `SettingsSchema` + `SETTINGS_DEFAULTS` (`schema.ts`), prefix `mihonweb_`.
2. Pakai `const [v, setV] = useSetting('mihonweb_…')`.
3. Tambah baris di tabel ini (lewat pemilik/senior — `.agents/` read-only).

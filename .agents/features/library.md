# Fitur: Library

**Route:** `/` · **Halaman:** `pages/Library.tsx` · **Komponen:** `MangaCard`/`MangaGrid`, `LibrarySheet`,
`LibraryUpdate`, `TopBar`, `Dialog`, `usePullToRefresh` · **API:** `api/library.ts`, `api/chapter.ts`, `api/updates.ts`

## Perilaku (padanan Mihon)

- Grid cover 2:3 dengan 4 mode: compact (judul di atas gradasi), comfortable (judul di bawah), cover only, list.
- Kolom: setelan portrait/landscape, `0` = otomatis (`minmax(104px, 1fr)`).
- Badge kiri atas: downloaded (`--tertiary`), unread (`--secondary`), bahasa — masing-masing bisa dimatikan.
- Tombol "lanjut baca" (opsional) → `/reader/<firstUnreadChapter.id>`.
- Tab kategori: tab Default (id 0) hanya tampil bila berisi atau satu-satunya kategori. Tab terakhir diingat.
- Top bar: cari (filter judul di klien), filter (buka `LibrarySheet`), ⋮ (Update library, Update kategori ini, Muat ulang).
- Tarik ke bawah = update kategori aktif (atau seluruh library bila tab tidak tampil).
- Kosong: `(･o･;)` + "Library kosong"; terfilter habis: "Tidak ada yang cocok dengan filter".
- **Tekan lama** → mode pilih banyak. Top bar: pilih semua, balik pilihan, batal. Bar aksi bawah:
  Kategori (set, bukan tambah), Dibaca, Belum, Unduh (chapter belum dibaca & belum diunduh), Hapus dari library (konfirmasi).

## Filter & sort (semua di klien, setelan di meta)

| Filter tri-state | Kondisi "only" |
|---|---|
| downloaded | `downloadCount > 0` |
| unread | `unreadCount > 0` |
| started | `latestReadChapter !== null` |
| bookmarked | `bookmarkCount > 0` |
| completed | `status === 'COMPLETED'` |

| Sort | Nilai |
|---|---|
| `alpha` | `title.localeCompare` |
| `total_chapters` | `chapters.totalCount` |
| `last_read` | `latestReadChapter.lastReadAt` |
| `last_update` | `latestFetchedChapter.fetchedAt` |
| `unread` | `unreadCount` |
| `latest_chapter` | `latestUploadedChapter.uploadDate` |
| `date_added` | `inLibraryAt` |
| `random` | hash(id, `mihonweb_library_random_seed`); pilih Random lagi = acak ulang |

Seri: sama nilai → urut judul. Memilih sort baru: `alpha` → asc, lainnya → desc; memilih sort yang sama = balik arah.

## Data

- Query `['library']` → `fetchLibrary()`: satu request berisi manga library + kategori.
- Aksi pilih banyak: ambil id chapter via `fetchChapterIdsForMangas(ids, {unreadOnly, notDownloadedOnly})`,
  lalu `updateChapters` / `enqueueDownloads`; kategori via `setMangasCategory` (`clearCategories` + `addToCategories`;
  id 0 = hanya clear). Setelah aksi: invalidasi `['library']`.
- Update library: `useLibraryUpdate().start(categoryIds?)` → lihat `features/auto-update.md`.

## Jebakan

- Kategori Default `id 0` bertabrakan dengan konsep "All" — jangan pakai 0 sebagai "semua".
- `inLibraryAt`, `lastReadAt`, `fetchedAt` = detik; `uploadDate` = ms (cukup untuk sort, penting untuk tampilan).
- Long-press harus batal saat menggulir (sudah di `useLongPress`).

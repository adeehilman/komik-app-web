# Fitur: Detail manga

**Route:** `/manga/:mangaId` · **Halaman:** `pages/Manga.tsx` · **Komponen:** `ChapterRow`, `TopBar`
**API:** `api/manga.ts`, `api/chapter.ts`

## Perilaku

- Header: backdrop cover blur, cover, judul, author/artist, status • nama source.
- Aksi: **Tambah ke library / Di library** (`updateManga patch.inLibrary`), **WebView** (buka `realUrl` di tab baru).
- Deskripsi terlipat 3 baris (tap untuk buka), chip genre.
- Daftar chapter: urutan terbaru dulu (toggle ↓/↑), chapter terbaca diredupkan, ikon bookmark,
  "Halaman N" bila sedang dibaca, tombol unduh / ikon sudah diunduh.
- FAB **Mulai / Lanjutkan** → chapter belum dibaca dengan `sourceOrder` terkecil.
- Refresh (ikon top bar) → `fetchManga` + `fetchChapters` dari source, progress bar tak tentu.
- **Otomatis** saat pertama dibuka: bila `initialized === false` → `fetchManga`; bila 0 chapter → `fetchChapters`
  (manga dari Browse belum punya data). Hanya sekali per kunjungan.
- Tekan lama chapter → mode pilih: Bookmark/Lepas, Dibaca, Belum (reset `lastPageRead` ke 0),
  **Sebelumnya** (hanya 1 terpilih: tandai semua `sourceOrder` lebih kecil sebagai dibaca), Unduh / Hapus unduhan.

## Data

- `['manga', id]` → `fetchMangaDetail`; `['chapters', id]` → `fetchMangaChapters` (urut `SOURCE_ORDER ASC`,
  dipakai bersama oleh Reader untuk prev/next).
- Setelah aksi: invalidasi `['manga', id]`, `['chapters', id]`, `['library']`.

## Jebakan

- `sourceOrder` naik = lama → baru. Jangan pakai `chapterNumber` untuk navigasi (bisa desimal/duplikat).
- `fetchChapters`/`fetchManga` menghubungi situs sumber — bisa lambat atau gagal (pesan ditampilkan di bawah header).

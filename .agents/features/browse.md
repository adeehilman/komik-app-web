# Fitur: Browse (source & extension)

**Route:** `/browse` (tab `Sources` | `?tab=extensions`), `/browse/source/:sourceId`
**Halaman:** `pages/Browse.tsx` (`SourcesTab`, `ExtensionsTab`), `pages/SourceBrowse.tsx`
**API:** `api/source.ts`, `api/extension.ts`

## Sources

- Daftar `sources` dikelompokkan per bahasa (`Intl.DisplayNames`, locale `id`); Local source (id `"0"`) di akhir.
- Tiap baris: ikon, nama, tombol **Latest** bila `supportsLatest`.
- Kosong (hanya Local source) → arahkan ke tab Extensions.

## Halaman source (`SourceBrowse`)

- Chip **Popular / Latest**; ikon cari → form, **dikirim saat Enter** (bukan tiap ketikan — setiap request
  menghantam situs sumber). Status di URL: `?type=LATEST`, `?q=…`.
- `useInfiniteQuery(['sourceManga', id, type, q])` → `fetchSourceManga(id, type, page, q)`;
  halaman berikutnya dimuat otomatis oleh `IntersectionObserver` (rootMargin 600px). Duplikat antar halaman dibuang per id.
- Grid compact; manga yang sudah di library diredupkan + badge "In library". Tap → `/manga/:id`.

## Extensions

- Pencarian nama, chip bahasa (setelan `mihonweb_browse_langs`, default `all,id,en`), tombol refresh repo
  (`fetchExtensions(input:{})`).
- Seksi: **Update tersedia** (`hasUpdate` / `isObsolete`), **Terpasang**, **Tersedia (n)** — tersedia difilter bahasa
  dan dibatasi 150 baris sampai "Tampilkan semua" (±1380 extension).
- Aksi: `changeExtension(pkgName, 'install' | 'update' | 'uninstall')` →
  `updateExtension(input:{ id: pkgName, patch:{ [aksi]: true } })`. Uninstall pakai konfirmasi.
  Setelah aksi: invalidasi `['extensions']` dan `['sources']`.

## Jebakan

- Tidak ada mutation `uninstallExtension` — uninstall adalah `updateExtension` dengan `patch.uninstall`.
- `fetchExtensions` wajib `input: {}`.
- Suwayomi tidak memverifikasi tanda tangan extension; repo selain keiyoushi = risiko keamanan (`nodes/access.md`).
- Cover dari CDN source bisa 404/522; kartu menampilkan placeholder.

# Node: WebUI (kerangka)

## Stack (dikunci — decisions D-06)

Vite 8 + React 19 + TypeScript 6 (strict, `noUnusedLocals`) · React Router 7 (**HashRouter**) ·
TanStack Query 5 · CSS biasa + CSS variables · lint: oxlint (bawaan template). Node.js 24, npm.

`vite.config.ts`: `base: './'` (aset relatif, bisa disajikan dari path mana pun) dan
`server.proxy['/api'] → http://127.0.0.1:4567` untuk dev.

## Struktur

```
webui/
├── index.html              meta iOS PWA (viewport-fit=cover, apple-mobile-web-app-*), manifest, ikon
├── public/                 manifest.webmanifest (standalone, #1B1B1F), icon-180/192/512.png
└── src/
    ├── main.tsx            mount React + index.css + installViewportFix()
    ├── viewportFix.ts      koreksi bug viewport iOS → CSS variable --vh-gap (lihat Tata letak & iOS)
    ├── App.tsx             QueryClient, HashRouter, routes, bottom nav, pemulihan scroll
    ├── index.css           reset + kelas UI bersama (list-item, chip, tab, btn, sheet, progress, action-bar…)
    ├── theme/tokens.css    palet dark Mihon (Apache-2.0) sebagai CSS variables
    ├── api/                satu file per domain GraphQL → nodes/graphql.md
    ├── settings/           schema.ts (key mihonweb_*), useSetting.ts → nodes/settings.md
    ├── components/         UI bersama (lihat tabel)
    ├── pages/              satu file per layar (lihat features/*)
    └── reader/             viewer & preload → features/reader.md
```

## Routing (`App.tsx`)

| Route | Halaman | Bottom nav |
|---|---|---|
| `/` | `LibraryPage` | ya |
| `/updates` | `UpdatesPage` | ya |
| `/history` | `HistoryPage` | ya |
| `/browse` (`?tab=extensions`) | `BrowsePage` | ya |
| `/browse/source/:sourceId` (`?type=LATEST`, `?q=`) | `SourceBrowsePage` | tidak |
| `/manga/:mangaId` | `MangaPage` | tidak |
| `/reader/:chapterId` | `ReaderRoute` → `Reader` (di-remount per chapter via `key`) | tidak |
| `/more` | `MorePage` | ya |
| `/settings` | `SettingsPage` | tidak |
| `/backup` | `BackupPage` | tidak |
| `*`, `/library` | redirect ke `/` | — |

HashRouter dipakai karena server menyajikan file statis tanpa fallback SPA.

## Komponen bersama (`src/components/`)

| Komponen | Fungsi | Dipakai di |
|---|---|---|
| `TopBar` | Bar atas sticky + safe area; `back`, `actions`, `children` (mode cari), `below` (tab/progress) | semua halaman kecuali Reader |
| `BottomNav` | 5 tab + badge jumlah chapter baru di Updates | `App` (hanya route utama) |
| `MangaCard`, `MangaGrid` | Kartu cover 2:3, 4 mode tampilan, badge, tombol lanjut baca, seleksi | Library, SourceBrowse |
| `ChapterRow` | Baris chapter (terbaca diredupkan, bookmark, progres, tombol unduh), long-press pilih | Manga |
| `EntryRow` (+ `groupByDay`, `dayLabel`) | Baris cover kecil + teks + aksi; pengelompokan per hari | Updates, History |
| `Sheet`, `Dialog` | Bottom sheet & dialog Material 3 | Library, Reader, Backup |
| `LibrarySheet` | Tab Filter / Sort / Display | Library |
| `LibraryUpdate` (`useLibraryUpdate`, `LibraryUpdateBar`) | Mulai/hentikan update library, polling progres 2 dtk | Library, Updates |
| `useLongPress` | Tekan lama (450 ms) dibatalkan bila jari bergeser >10 px | MangaCard, ChapterRow |
| `usePullToRefresh`, `PullIndicator` | Tarik ke bawah di `#root` | Library, Updates |
| `Icon` | Path Material Icons terpusat | semua |

## State & cache

- Data server: TanStack Query. Default `staleTime` 5 menit, `retry` 1, `refetchOnWindowFocus` mati.
  Daftar query key: `best-practices.md`.
- Setelan: global meta via `useSetting` (satu query `['globalMeta']` untuk semua key).
- State UI lokal (`useState`) untuk pencarian, seleksi, dialog. Tidak ada state manager global.
- Gambar: cache HTTP browser + preload (`reader/preload.ts`). Tidak ada service worker.

## Tata letak & iOS

- `#root` = kontainer scroll (`height: var(--app-height, 100dvh); overflow-y: auto`). `App` menyimpan posisi scroll per entri
  riwayat: navigasi baru mulai di atas, tombol kembali memulihkan posisi.
- `.app.with-nav` memberi ruang bawah untuk bottom nav + `safe-area-inset-bottom`.
- Reader `position: fixed; z-index: 1200` di atas semuanya, sampai tepi bawah layar (lihat `--vh-gap`).
- **Status bar PWA = `black-translucent`** (W-14, D-12): konten tampil sampai ke belakang jam & baterai.
  Teks status bar selalu putih (tidak bisa mengikuti warna konten — batasan web app iOS).
- **Koreksi `--vh-gap` (`src/viewportFix.ts`, dipanggil di `main.tsx`):** bug WebKit — di PWA standalone dengan
  `black-translucent`, kotak acuan `position: fixed` **kadang** lebih pendek setinggi status bar (47pt di iPhone 13 Pro).
  Bug tidak konsisten, dan `innerHeight` bisa "pendek" walau `fixed` sudah benar — **jangan pakai `innerHeight`**
  (versi pertama W-14 begitu dan mendorong nav 47pt ke bawah layar). Yang diukur: probe `fixed; top:0; bottom:0`.
  `--vh-gap` = tinggi layar − tinggi probe (0 di browser biasa / status bar `black` / selisih > 100px);
  `--app-height` = tinggi probe + gap, dipakai `html/body/#root`. Diukur ulang saat `resize`, `orientationchange`,
  `pageshow`, `visibilitychange` (+300 ms, +1 s). Terverifikasi di iPhone 13 Pro.
- **Aturan wajib:** setiap elemen `position: fixed` yang menempel ke bawah memakai
  `bottom: calc(-1 * var(--vh-gap, 0px))` (atau `inset: 0 0 calc(-1 * var(--vh-gap, 0px)) 0`), dan tinggi berbasis
  `100dvh` ditulis `calc(100dvh + var(--vh-gap, 0px))`. Pemakai saat ini: `html/body/#root` (via `--app-height`) & `.action-bar`
  (`index.css`), `.bottom-nav`, `.sheet-backdrop/.dialog-backdrop` (`Sheet.css`), `.fab` (`Manga.css`),
  `.reader` & gambar `fit-screen`/`fit-height` (`Reader.css`).
- **Bottom nav semi-transparan** (`rgba(33,31,38,0.82)` + `backdrop-filter: blur(16px) saturate(140%)`): isi halaman
  terlihat samar di belakangnya.
- Tetap pakai `env(safe-area-inset-*)` untuk semua padding tepi (atas = tinggi status bar; bawah = area home
  indicator 34pt yang memang tidak bisa dipakai). Top bar wajib `padding-top: env(safe-area-inset-top)`.
- Mengubah meta status bar baru berlaku setelah ikon Home Screen dihapus dan ditambahkan ulang.
- **Rollback W-14:** ganti meta ke `content="black"` → build → `docker compose restart` → tambah ulang ikon.
  `--vh-gap` otomatis 0; CSS lain boleh tetap.

## Build & deploy

```bash
cd webui && npm run build        # tsc -b && vite build → webui/dist
cd .. && docker compose restart  # server menyalin webUI/ saat start
```

Dev: `cd webui && npx vite --host 127.0.0.1` → `http://127.0.0.1:5173` (API diproksikan ke server asli —
**data nyata**, hati-hati dengan mutation).

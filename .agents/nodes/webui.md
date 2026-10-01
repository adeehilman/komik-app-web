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
    ├── main.tsx            mount React + index.css
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

- `#root` = kontainer scroll (`height: 100dvh; overflow-y: auto`). `App` menyimpan posisi scroll per entri
  riwayat: navigasi baru mulai di atas, tombol kembali memulihkan posisi.
- `.app.with-nav` memberi ruang bawah untuk bottom nav + `safe-area-inset-bottom`.
- Reader `position: fixed; inset: 0; z-index: 1200` di atas semuanya.
- Status bar `black-translucent`: konten berada di bawah status bar, jadi top bar wajib `safe-area-inset-top`.

## Build & deploy

```bash
cd webui && npm run build        # tsc -b && vite build → webui/dist
cd .. && docker compose restart  # server menyalin webUI/ saat start
```

Dev: `cd webui && npx vite --host 127.0.0.1` → `http://127.0.0.1:5173` (API diproksikan ke server asli —
**data nyata**, hati-hati dengan mutation).

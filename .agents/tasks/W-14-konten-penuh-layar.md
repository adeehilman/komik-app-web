# W-14 — Konten sampai belakang status bar & belakang bottom nav (iPhone PWA)

Status: **selesai, disetujui pemilik** (catatan: `viewportFix.ts` kemudian diganti senior ke metode probe — lihat `nodes/webui.md`) · Penulis: senior · 2026-10-01 · Eksekutor: Gemini Flash (`agy`)

## Tujuan (hanya dua, sisanya jangan diubah)

1. **Konten sampai ke belakang jam & baterai** (seperti Instagram Reels): status bar PWA tembus
   (`black-translucent`). Paling terlihat di Reader.
2. **Konten terlihat di belakang bottom nav**: nav semi-transparan + blur, isi halaman menggulir di belakangnya.

## Latar belakang (wajib dipahami)

- W-13 mengganti status bar ke `black` karena bug WebKit: di PWA standalone dengan `black-translucent`,
  `window.innerHeight` kurang sebesar tinggi status bar (47pt di iPhone 13 Pro), sehingga semua elemen
  `position: fixed; bottom: 0` melayang 47pt di atas tepi layar (lihat `.agents/decisions.md` D-11).
- W-14 kembali ke `black-translucent` **dan** mengoreksi bug itu: ukur selisih tinggi layar asli vs
  `innerHeight`, simpan di CSS variable `--vh-gap`, lalu pakai untuk memanjangkan halaman dan menurunkan
  semua elemen bawah ke tepi layar.
- Koreksi hanya aktif bila: dibuka dari Home Screen (`navigator.standalone === true`) **dan** meta status bar
  = `black-translucent`. Jadi rollback cukup mengganti meta kembali ke `black` (koreksi otomatis jadi 0).
- Semua padding safe-area sudah memakai `env(safe-area-inset-*)` — top bar, judul, dan tombol tetap aman di
  bawah status bar. **Jangan ubah padding safe-area.**

## Langkah

### 1. `webui/index.html` — satu baris

```html
<meta name="apple-mobile-web-app-status-bar-style" content="black" />
```
→
```html
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
```

### 2. File baru `webui/src/viewportFix.ts` — tempel persis

```ts
/*
 * Koreksi bug WebKit (W-14, .agents/decisions.md D-11/D-12): di PWA iOS standalone dengan status bar
 * `black-translucent`, window.innerHeight kurang setinggi status bar. Selisihnya disimpan di --vh-gap
 * dan dipakai CSS untuk memanjangkan halaman & menurunkan elemen bawah ke tepi layar.
 * Di luar kondisi itu --vh-gap = 0px (tidak berefek).
 */
const MAX_GAP_PX = 100 // lebih besar dari ini = keyboard/kondisi lain, bukan bug status bar

function isAffected(): boolean {
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  const meta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')
  return standalone && meta?.getAttribute('content') === 'black-translucent'
}

let lastGap = 0

function update() {
  let gap = 0
  if (isAffected()) {
    // Di iOS, screen.width/height tidak ikut berputar: height = sisi panjang saat portrait.
    const portrait = window.innerHeight >= window.innerWidth
    const fullHeight = portrait ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height)
    gap = Math.round(fullHeight - window.innerHeight)
    if (gap < 0 || gap > MAX_GAP_PX) gap = lastGap
  }
  lastGap = gap
  document.documentElement.style.setProperty('--vh-gap', `${gap}px`)
}

export function installViewportFix() {
  update()
  window.addEventListener('resize', update)
  window.addEventListener('orientationchange', () => window.setTimeout(update, 300))
}
```

### 3. `webui/src/main.tsx` — panggil sebelum render

Tambahkan import dan pemanggilan, tanpa mengubah baris lain:

```ts
import { installViewportFix } from './viewportFix'

installViewportFix()
```
(letakkan import bersama import lain; `installViewportFix()` tepat sebelum `createRoot(...)`.)

### 4. CSS — ganti persis baris berikut (cari teks kiri, ganti dengan teks kanan)

| File | Cari | Ganti |
|---|---|---|
| `src/index.css` (aturan `html, body, #root`) | `height: 100dvh;` | `height: calc(100dvh + var(--vh-gap, 0px));` |
| `src/index.css` (aturan `.action-bar`) | `bottom: 0;` | `bottom: calc(-1 * var(--vh-gap, 0px));` |
| `src/components/BottomNav.css` (`.bottom-nav`) | `bottom: 0;` | `bottom: calc(-1 * var(--vh-gap, 0px));` |
| `src/components/BottomNav.css` (`.bottom-nav`) | `background-color: var(--surface-variant);` | `background-color: rgba(33, 31, 38, 0.82);`<br>`-webkit-backdrop-filter: blur(16px) saturate(140%);`<br>`backdrop-filter: blur(16px) saturate(140%);` |
| `src/components/Sheet.css` (`.sheet-backdrop, .dialog-backdrop`) | `inset: 0;` | `inset: 0 0 calc(-1 * var(--vh-gap, 0px)) 0;` |
| `src/pages/Manga.css` (`.fab`) | `bottom: calc(16px + env(safe-area-inset-bottom, 0px));` | `bottom: calc(16px + env(safe-area-inset-bottom, 0px) - var(--vh-gap, 0px));` |
| `src/pages/Reader.css` (`.reader`) | `inset: 0;` | `inset: 0 0 calc(-1 * var(--vh-gap, 0px)) 0;` |
| `src/pages/Reader.css` (`.fit-screen .paged-page img`) | `max-height: 100dvh;` | `max-height: calc(100dvh + var(--vh-gap, 0px));` |
| `src/pages/Reader.css` (`.fit-height .paged-page img`) | `height: 100dvh;` | `height: calc(100dvh + var(--vh-gap, 0px));` |

Catatan:
- **Urutan di `Reader.css` penting:** ganti baris `max-height: 100dvh;` (di `.fit-screen .paged-page img`) **lebih dulu**.
  Teks `height: 100dvh;` juga merupakan bagian dari `max-height: 100dvh;`; setelah baris max-height diganti, sisa
  `height: 100dvh;` tinggal satu, yaitu di `.fit-height .paged-page img`.
- `src/index.css` punya `bottom: 0` hanya di `.action-bar` dan `inset: 0` di `.menu-scrim` — **jangan** ubah `.menu-scrim`.
- Jangan ubah `.top-bar`, `.reader-topbar`, `.reader-bottombar`, padding safe-area, warna lain.
- Total file yang disentuh: `index.html`, `main.tsx`, `viewportFix.ts` (baru), `index.css`, `BottomNav.css`,
  `Sheet.css`, `Manga.css`, `Reader.css`. Tidak ada yang lain.

### 5. Verifikasi otomatis (tempel output asli)

```bash
cd webui
npm run build && npm run lint
grep -c 'content="black-translucent"' dist/index.html          # → 1
grep -rn -- "--vh-gap" src | wc -l                              # → minimal 10
grep -c "backdrop-filter" src/components/BottomNav.css          # → 2
cd .. && docker compose restart
curl -s http://127.0.0.1:4567/ | grep -o 'status-bar-style" content="[^"]*"'   # → content="black-translucent"
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4567                 # → 200
git diff --stat                                                  # hanya 7 file di atas + viewportFix.ts (untracked)
```

Build/lint gagal 2x → STOP, laporkan error asli. Jangan commit/push.

## Verifikasi manual (pemilik, iPhone) — wajib

1. Hapus ikon "Mihon" dari Home Screen → Safari → alamat Tailscale → Share → Add to Home Screen → buka dari ikon.
2. **Reader (webtoon)**: gambar terlihat di belakang jam & baterai.
3. **Library**: gulir — cover terlihat samar (blur) di belakang bottom nav; nav menempel ke tepi bawah,
   **tidak ada pita gelap** di bawahnya.
4. Judul top bar tidak tertutup jam (Library, Manga, Settings).
5. Library → tekan lama 1 manga → bar aksi menempel ke bawah. Detail manga → tombol Mulai/Lanjutkan tidak
   terlalu turun/naik. Library → filter → sheet menempel ke bawah.
6. Reader → tap tengah → bar bawah reader menempel ke bawah.
7. Putar ke landscape lalu kembali portrait → nav tetap menempel. Buka pencarian (keyboard) → tutup → nav tetap benar.
8. Kirim screenshot Library & Reader.

## Kalau gagal di iPhone

- Nav/bar bawah **melayang** atau **terpotong** di bawah layar → rollback cepat: ubah meta di `index.html`
  kembali ke `content="black"`, build, `docker compose restart`, tambah ulang ikon. Koreksi `--vh-gap` otomatis
  0 (kode lain boleh tetap). Laporkan screenshot ke senior — **jangan** coba angka/rumus lain sendiri.
- Hanya blur nav yang tidak disukai → laporkan, jangan ubah.

## Setelah lulus (senior)

- `.agents/decisions.md`: tambah D-12 (kembali ke `black-translucent` + koreksi `--vh-gap`; D-11 jadi "diganti").
- `.agents/nodes/webui.md` bagian "Tata letak & iOS": jelaskan `--vh-gap` dan elemen yang memakainya;
  aturan: **setiap elemen `position: fixed` yang menempel bawah wajib memakai `calc(-1 * var(--vh-gap, 0px))`**.
- `.agents/status.md`, recap, commit + push.

## Prompt pembuka sesi `agy` (tempel apa adanya)

```
Baca AGENTS.md, .agents/README.md, .agents/rules.md, .agents/nodes/webui.md, lalu .agents/tasks/W-14-konten-penuh-layar.md.
Semua aturan mengikat. Folder .agents/ read-only.

Task sesi ini: W-14 saja, persis sesuai langkah 1–5 di file task. Tempel kode apa adanya, jangan improvisasi,
jangan ubah file selain yang tercantum. Jangan commit/push.
Jalankan semua perintah verifikasi langkah 5 dan laporkan output ASLI (format .agents/rules.md §7).
Uji iPhone tandai ⏳. Lalu berhenti.
```

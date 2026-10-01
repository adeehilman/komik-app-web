# W-16 — Muat seluruh chapter yang sedang dibuka

Status: **selesai, disetujui pemilik** · Penulis: senior · 2026-10-01 · Eksekutor: Gemini Flash (`agy`) · Bergantung: W-15

## Tujuan

Saat chapter dibuka, **semua halamannya** diunduh di belakang layar dari halaman setelah posisi awal sampai akhir
(lalu halaman sebelumnya), 3 sekaligus, dengan coba-ulang otomatis. Hasilnya masuk cache service worker (W-15),
sehingga menggulir cepat tidak memunculkan spinner untuk halaman yang sudah masuk, dan halaman yang sudah termuat
tetap ada walau jaringan putus di tengah.

- Hanya chapter yang **sedang dibuka** (bukan chapter berikutnya — itu tetap preload 6 halaman yang sudah ada).
- Setelan baru `mihonweb_reader_preload_all` (default **nyala**), bisa dimatikan di menu setelan Reader.
- Indikator: garis progres 2px di atas layar selama belum lengkap + teks "dimuat x/y" di menu Reader.
- Jaringan kembali (`online`) → halaman yang gagal dicoba lagi.

Konsekuensi: tiap chapter yang dibuka langsung memakai ±20 MB kuota walau hanya dibaca sebagian.

## Latar belakang

- Halaman 700–900 KB (±20 MB/chapter). Preload lama hanya 6 halaman di depan posisi dan baru maju bila pengguna maju.
- `fetch()` dari halaman melewati service worker (`public/sw.js`, `route()` → `mihon-pages-v1`, cache-first), jadi
  gambar yang diunduh hook ini otomatis tersimpan; `<img>` kemudian mengambilnya dari cache.
- Saat preload-seluruh-chapter aktif, `preloadAround()` dimatikan supaya halaman tidak diunduh dua kali.

## Langkah

### 1. File baru `webui/src/reader/useChapterPreloader.ts` — tempel persis

```ts
import { useEffect, useState } from 'react'

/*
 * Muat seluruh halaman chapter di belakang layar (W-16). Urutan: mulai dari `startIndex` sampai akhir, lalu
 * halaman sebelumnya; 3 sekaligus; tiap halaman dicoba ulang. Gambar masuk cache service worker (W-15), jadi
 * <img> mengambilnya instan dan halaman yang sudah termuat tetap ada walau jaringan putus.
 */
const CONCURRENCY = 3
const RETRY_DELAYS_MS = [1000, 3000, 8000]

export interface PreloadProgress {
  loaded: number
  failed: number
  total: number
}

export function useChapterPreloader(pages: string[], startIndex: number, enabled: boolean): PreloadProgress {
  const [progress, setProgress] = useState<PreloadProgress>({ loaded: 0, failed: 0, total: 0 })

  useEffect(() => {
    if (!enabled || pages.length === 0) return
    const controller = new AbortController()
    const done = new Set<number>()
    const failed = new Set<number>()
    const total = pages.length
    const distance = (i: number) => (i >= startIndex ? i - startIndex : total + i)
    const queue = [...pages.keys()].sort((a, b) => distance(a) - distance(b))
    let cursor = 0
    let running = 0

    const report = () => {
      if (!controller.signal.aborted) setProgress({ loaded: done.size, failed: failed.size, total })
    }
    const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

    const loadOne = async (i: number) => {
      for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
        if (controller.signal.aborted) return
        try {
          const res = await fetch(pages[i], { signal: controller.signal })
          if (res.ok) {
            await res.blob() // tunggu seluruh gambar diterima (dan tersimpan di cache)
            done.add(i)
            failed.delete(i)
            report()
            return
          }
        } catch {
          if (controller.signal.aborted) return
        }
        if (attempt < RETRY_DELAYS_MS.length) await sleep(RETRY_DELAYS_MS[attempt])
      }
      failed.add(i)
      report()
    }

    const worker = async () => {
      running++
      while (!controller.signal.aborted && cursor < queue.length) {
        const i = queue[cursor++]
        if (!done.has(i)) await loadOne(i)
      }
      running--
    }

    const start = () => {
      for (let w = running; w < CONCURRENCY; w++) void worker()
    }

    // Jaringan kembali: antrekan ulang halaman yang gagal.
    const onOnline = () => {
      if (failed.size === 0) return
      queue.push(...failed)
      failed.clear()
      report()
      start()
    }

    report()
    start()
    window.addEventListener('online', onOnline)
    return () => {
      controller.abort()
      window.removeEventListener('online', onOnline)
    }
  }, [pages, startIndex, enabled])

  return progress
}
```

### 2. `webui/src/settings/schema.ts` — dua penggantian

| Cari | Ganti |
|---|---|
| `  mihonweb_updates_last_seen: number // detik epoch; badge chapter baru di tab Updates (W-12)` | `  mihonweb_updates_last_seen: number // detik epoch; badge chapter baru di tab Updates (W-12)`<br>`  mihonweb_reader_preload_all: boolean // muat seluruh halaman chapter yang dibuka (W-16)` |
| `  mihonweb_updates_last_seen: 0,` | `  mihonweb_updates_last_seen: 0,`<br>`  mihonweb_reader_preload_all: true,` |

### 3. `webui/src/pages/Reader.tsx` — enam penggantian (urut dari atas)

**3a. Import** — cari:
```tsx
import { NEXT_CHAPTER_THRESHOLD, preloadAround, preloadImage } from '../reader/preload'
```
ganti:
```tsx
import { NEXT_CHAPTER_THRESHOLD, preloadAround, preloadImage } from '../reader/preload'
import { useChapterPreloader } from '../reader/useChapterPreloader'
```

**3b. Setelan** — cari:
```tsx
  const [gap, setGap] = useSetting('mihonweb_reader_webtoon_gap')
```
ganti:
```tsx
  const [gap, setGap] = useSetting('mihonweb_reader_webtoon_gap')
  const [preloadAll, setPreloadAll] = useSetting('mihonweb_reader_preload_all')
```

**3c. Preload lama dimatikan bila muat-seluruh aktif** — cari:
```tsx
    preloadAround(pageList, index)
```
ganti:
```tsx
    if (!preloadAll) preloadAround(pageList, index)
```

**3d. Dependensi efek preload** — cari:
```tsx
  }, [index, total, pageList, next, queryClient])
```
ganti:
```tsx
  }, [index, total, pageList, next, queryClient, preloadAll])

  /* ---------- Muat seluruh chapter (W-16) ---------- */
  const preload = useChapterPreloader(pageList, startIndex + 1, preloadAll && index !== null)
  const preloading = preloadAll && preload.total > 0 && preload.loaded + preload.failed < preload.total
```

**3e. Garis progres + teks di menu** — cari:
```tsx
      {menu && (
```
ganti:
```tsx
      {preloading && (
        <div className="reader-preload-bar" aria-hidden="true">
          <div style={{ width: `${(preload.loaded / preload.total) * 100}%` }} />
        </div>
      )}

      {menu && (
```

lalu cari:
```tsx
              <span className="reader-chapter">{chapter.data?.name}</span>
```
ganti:
```tsx
              <span className="reader-chapter">
                {chapter.data?.name}
                {preloadAll && preload.total > 0 && ` · dimuat ${preload.loaded}/${preload.total}`}
                {preload.failed > 0 && ` · ${preload.failed} gagal`}
              </span>
```

**3f. Toggle di sheet setelan** — cari (penutup sheet, unik):
```tsx
            <span className="list-item-subtitle">Tap tepi layar untuk pindah halaman</span>
          </span>
        </label>
      </Sheet>
```
ganti:
```tsx
            <span className="list-item-subtitle">Tap tepi layar untuk pindah halaman</span>
          </span>
        </label>

        <label className="list-item">
          <input type="checkbox" checked={preloadAll} onChange={(e) => setPreloadAll(e.target.checked)} />
          <span className="list-item-text">
            <span className="list-item-title">Muat seluruh chapter</span>
            <span className="list-item-subtitle">Semua halaman diunduh saat chapter dibuka (±20 MB per chapter)</span>
          </span>
        </label>
      </Sheet>
```

### 4. `webui/src/pages/Reader.css` — tambahkan di **akhir file**

```css

/* Garis progres muat seluruh chapter (W-16) */
.reader-preload-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 3;
  height: 2px;
  background-color: rgba(255, 255, 255, 0.12);
  pointer-events: none;
}

.reader-preload-bar > div {
  height: 100%;
  background-color: var(--primary);
  transition: width 0.3s;
}
```

Total file disentuh: `src/reader/useChapterPreloader.ts` (baru), `src/settings/schema.ts`, `src/pages/Reader.tsx`,
`src/pages/Reader.css`. Tidak ada yang lain (`sw.js` **tidak** diubah).

### 5. Verifikasi otomatis (tempel output asli)

```bash
cd webui
npm run build && npm run lint
grep -c "mihonweb_reader_preload_all" src/settings/schema.ts        # → 2
grep -c "useChapterPreloader" src/pages/Reader.tsx                   # → 2
grep -c "Muat seluruh chapter" dist/assets/*.js                      # → 1
cd .. && docker compose restart
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4567       # → 200 (ulang sampai server siap)
git status --short                                                   # hanya 4 file di atas
```

Build/lint gagal 2× → STOP, laporkan error asli. Jangan commit/push.

## Verifikasi manual (pemilik, iPhone)

1. Tutup app sepenuhnya → buka lagi (service worker mengambil versi baru; bila belum berubah, tutup-buka sekali lagi).
2. Buka chapter yang **belum pernah** dibuka → garis biru tipis di atas layar berjalan; tap tengah → "dimuat x/27".
3. Tanpa menggulir, tunggu garis hilang → gulir cepat ke akhir → **tidak ada spinner**.
4. Buka chapter lain → nyalakan mode pesawat di tengah muat → gulir: halaman yang sudah masuk tampil; matikan
   mode pesawat → sisa halaman lanjut termuat (atau "x gagal" lalu lanjut).
5. Menu setelan Reader → matikan "Muat seluruh chapter" → buka chapter baru → garis tidak muncul (perilaku lama).
6. Setelan tersimpan setelah app ditutup (disimpan di server meta).

## Setelah lulus (senior)

`.agents/features/reader.md` (bagian Preload), `.agents/nodes/settings.md` (key baru), `status.md`, recap; commit + push.

## Prompt pembuka sesi `agy` (tempel apa adanya)

```
Baca AGENTS.md, .agents/README.md, .agents/rules.md, .agents/features/reader.md, lalu .agents/tasks/W-16-muat-seluruh-chapter.md.
Semua aturan mengikat. Folder .agents/ read-only.

Task sesi ini: W-16 saja, persis sesuai langkah 1–5 di file task. Tempel kode apa adanya, lakukan penggantian
cari→ganti persis dan berurutan, jangan improvisasi, jangan ubah file selain yang tercantum. Jangan commit/push.
Jalankan semua perintah verifikasi langkah 5 dan laporkan output ASLI (format .agents/rules.md §7).
Uji iPhone tandai ⏳. Lalu berhenti.
```

# W-15 — Service worker: cache gambar & app shell di iPhone

Status: **selesai, disetujui pemilik** · Penulis: senior · 2026-10-01 · Eksekutor: Gemini Flash (`agy`) · Keputusan: D-13

## Tujuan

1. App terbuka **instan** dari Home Screen (app shell dari cache, diperbarui di belakang layar).
2. Halaman chapter, cover, dan ikon extension yang pernah dimuat (termasuk hasil preload) **disimpan di iPhone**
   — dibuka lagi tanpa mengunduh ulang 700–900 KB per halaman. Halaman ±30 hari, cover ±7 hari.
3. Preload lebih jauh: 6 halaman ke depan, dan 6 halaman pertama chapter berikutnya.
4. Di More → Settings: lihat pemakaian penyimpanan & tombol hapus cache gambar.

**Bukan** tujuan: offline mode penuh. Request GraphQL (`/api/graphql`) tidak pernah di-cache — tanpa koneksi ke server,
daftar halaman tidak bisa diambil walau gambarnya ada di cache.

## Latar belakang

- Halaman chapter 700–900 KB (±20 MB/chapter); bottleneck = upload rumah + 4G (`status.md`, recap).
- Server mengirim `Cache-Control: max-age=0` untuk file app → tiap buka app Safari bertanya ulang ke server.
- Cache HTTP Safari bisa dikosongkan iOS kapan saja. Cache Storage milik web app Home Screen lebih awet
  (dikecualikan dari penghapusan 7 hari Safari), tapi iOS tetap bisa mengosongkan saat storage perangkat penuh.
- Service worker hanya jalan di HTTPS / localhost → lewat Tailscale `https://<tailnet-host>.ts.net` OK.
- URL halaman berbasis **urutan chapter**, bukan id (`/api/v1/manga/<m>/chapter/<sourceOrder>/page/<n>`). Bila source
  menyisipkan chapter di tengah (jarang), gambar cache bisa salah sampai kedaluwarsa → tombol "Hapus" di Settings.

## Langkah

### 1. File baru `webui/public/sw.js` — tempel persis

```js
/*
 * Service worker WebUI Mihon-style (W-15, .agents/decisions.md D-13). Vanilla, tanpa library.
 * - App shell: stale-while-revalidate (buka instan, diperbarui di belakang layar).
 * - Asset ber-hash (/assets/*): cache-first, tidak kedaluwarsa (nama file berubah tiap build).
 * - Halaman chapter, cover, ikon extension: cache-first dengan batas umur & jumlah entri.
 * - GraphQL & API lain: TIDAK di-cache (selalu jaringan).
 */
const VERSION = 'v1'
const SHELL = `mihon-shell-${VERSION}`
const PAGES = `mihon-pages-${VERSION}`
const COVERS = `mihon-covers-${VERSION}`
const ICONS = `mihon-icons-${VERSION}`
const ALL = [SHELL, PAGES, COVERS, ICONS]

// Jumlah entri maksimum per cache (yang terlama dibuang lebih dulu).
const LIMITS = { [SHELL]: 60, [PAGES]: 800, [COVERS]: 600, [ICONS]: 300 }
// Umur maksimum entri.
const DAY = 24 * 60 * 60 * 1000
const MAX_AGE = { [PAGES]: 30 * DAY, [COVERS]: 7 * DAY, [ICONS]: 30 * DAY }

const CACHED_AT = 'x-sw-cached-at'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith('mihon-') && !ALL.includes(key)) await caches.delete(key)
      }
      await self.clients.claim()
    })(),
  )
})

/** Tentukan cache untuk sebuah URL; null = jangan disentuh service worker. */
function route(url) {
  if (url.origin !== self.location.origin) return null
  const p = url.pathname
  if (/\/api\/v1\/manga\/\d+\/chapter\/\d+\/page\/\d+$/.test(p)) return PAGES
  if (/\/api\/v1\/manga\/\d+\/thumbnail$/.test(p)) return COVERS
  if (p.includes('/api/v1/extension/icon/')) return ICONS
  if (p.includes('/api/')) return null
  if (p.includes('/assets/')) return 'asset'
  return 'shell'
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  const kind = route(url)
  if (!kind) return
  if (kind === 'shell') {
    event.respondWith(staleWhileRevalidate(event, req))
  } else if (kind === 'asset') {
    event.respondWith(cacheFirst(event, req, SHELL, req.url))
  } else {
    // Kunci tanpa query string: `?retry=n` dari PageImage tetap memakai entri yang sama.
    event.respondWith(cacheFirst(event, req, kind, url.origin + url.pathname))
  }
})

async function cacheFirst(event, req, name, key) {
  const cache = await caches.open(name)
  const hit = await cache.match(key, { ignoreVary: true })
  if (hit && !isExpired(hit, name)) return hit
  try {
    const res = await fetch(req)
    if (res.ok) event.waitUntil(store(cache, name, key, res.clone()))
    return res
  } catch (err) {
    if (hit) return hit // jaringan putus: pakai yang kedaluwarsa daripada gagal
    throw err
  }
}

async function staleWhileRevalidate(event, req) {
  const cache = await caches.open(SHELL)
  const key = new URL(req.url).pathname === '/' ? '/' : req.url
  const hit = await cache.match(key, { ignoreVary: true, ignoreSearch: true })
  const network = fetch(req)
    .then((res) => {
      if (res.ok) event.waitUntil(store(cache, SHELL, key, res.clone()))
      return res
    })
    .catch(() => null)
  if (hit) {
    event.waitUntil(network)
    return hit
  }
  const res = await network
  return res ?? Response.error()
}

async function store(cache, name, key, res) {
  const headers = new Headers(res.headers)
  headers.set(CACHED_AT, String(Date.now()))
  const body = await res.blob()
  await cache.put(key, new Response(body, { status: res.status, statusText: res.statusText, headers }))
  await trim(cache, name)
}

function isExpired(res, name) {
  const max = MAX_AGE[name]
  if (!max) return false
  const at = Number(res.headers.get(CACHED_AT) || 0)
  return !at || Date.now() - at > max
}

async function trim(cache, name) {
  const max = LIMITS[name]
  if (!max) return
  const keys = await cache.keys()
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i])
}
```

### 2. `webui/src/main.tsx` — daftarkan service worker (hanya build produksi)

Tambahkan blok ini **di akhir file** (setelah `createRoot(...).render(...)`), tanpa mengubah baris lain:

```ts
// Service worker: cache app shell & gambar di perangkat (W-15, .agents/decisions.md D-13).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {})
    // Minta storage persisten agar iOS tidak cepat mengosongkan cache (boleh ditolak).
    navigator.storage?.persist?.().catch(() => {})
  })
}
```

### 3. File baru `webui/src/components/DeviceStorage.tsx` — tempel persis

```tsx
import { useEffect, useState } from 'react'

/** Pemakaian & penghapusan cache service worker di perangkat ini (W-15). */
const IMAGE_CACHE_PREFIXES = ['mihon-pages-', 'mihon-covers-', 'mihon-icons-']

function formatMB(bytes: number): string {
  return `${Math.round(bytes / 1024 / 1024)} MB`
}

export function DeviceStorage() {
  const [usage, setUsage] = useState('menghitung…')
  const [busy, setBusy] = useState(false)
  const active = 'serviceWorker' in navigator && navigator.serviceWorker.controller !== null
  const supported = typeof caches !== 'undefined'

  const refresh = async () => {
    try {
      const est = await navigator.storage?.estimate?.()
      if (est?.usage === undefined) setUsage('tidak tersedia')
      else setUsage(est.quota ? `${formatMB(est.usage)} dari ${formatMB(est.quota)}` : formatMB(est.usage))
    } catch {
      setUsage('tidak tersedia')
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const clear = async () => {
    if (!window.confirm('Hapus cache gambar di perangkat ini? Halaman akan diunduh ulang saat dibuka.')) return
    setBusy(true)
    try {
      for (const key of await caches.keys()) {
        if (IMAGE_CACHE_PREFIXES.some((p) => key.startsWith(p))) await caches.delete(key)
      }
    } finally {
      setBusy(false)
      refresh()
    }
  }

  return (
    <>
      <div className="section-title">Penyimpanan di perangkat</div>
      <div className="list-item">
        <span className="list-item-text">
          <span className="list-item-title">Cache gambar & aplikasi</span>
          <span className="list-item-subtitle">
            {active ? 'Aktif' : 'Belum aktif — tutup lalu buka ulang aplikasi'} · {usage}
          </span>
        </span>
        <button type="button" className="btn btn-text" disabled={busy || !supported} onClick={clear}>
          Hapus
        </button>
      </div>
    </>
  )
}
```

### 4. `webui/src/pages/Settings.tsx` — pasang komponen

a. Tambah import tepat **setelah** baris:
```ts
import type { SettingsSchema } from '../settings/schema'
```
baris baru:
```ts
import { DeviceStorage } from '../components/DeviceStorage'
```

b. Cari blok penutup ini (unik, di akhir file):
```tsx
        </select>
      </label>
    </div>
  )
}
```
ganti dengan:
```tsx
        </select>
      </label>

      <DeviceStorage />
    </div>
  )
}
```

### 5. Preload lebih jauh — dua penggantian

| File | Cari | Ganti |
|---|---|---|
| `webui/src/reader/preload.ts` | `export const PRELOAD_AHEAD = 4` | `export const PRELOAD_AHEAD = 6` |
| `webui/src/pages/Reader.tsx` | `nextPages?.slice(0, 2).forEach(preloadImage)` | `nextPages?.slice(0, 6).forEach(preloadImage)` |

Total file disentuh: `public/sw.js` (baru), `src/components/DeviceStorage.tsx` (baru), `src/main.tsx`,
`src/pages/Settings.tsx`, `src/reader/preload.ts`, `src/pages/Reader.tsx`. Tidak ada yang lain.

### 6. Verifikasi otomatis (tempel output asli)

```bash
cd webui
npm run build && npm run lint
ls -la dist/sw.js                                                   # ada
grep -c "serviceWorker.register" dist/assets/*.js                   # → 1
cd .. && docker compose restart
# tunggu server siap (ulang sampai 200):
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4567
curl -s -o /dev/null -w "sw.js: %{http_code} %{content_type}\n" http://127.0.0.1:4567/sw.js   # → 200 dan content-type berisi javascript
curl -s http://127.0.0.1:4567/sw.js | head -3                       # → komentar "Service worker WebUI Mihon-style"
git status --short                                                  # hanya 6 file di atas
```

**STOP** (jangan diakali) bila: build/lint gagal 2×; `sw.js` tidak 200; atau `content-type` **bukan** javascript
(browser menolak service worker dengan MIME lain) — laporkan output aslinya. Jangan commit/push.

## Verifikasi manual (pemilik, iPhone)

1. Tutup app sepenuhnya, buka dari ikon **dua kali** (pembukaan pertama memasang service worker).
2. More → Settings → "Penyimpanan di perangkat" → status **Aktif** + angka MB.
3. Baca 1 chapter sampai akhir → keluar → angka MB naik.
4. Buka chapter yang sama lagi → halaman muncul **instan** tanpa spinner.
5. Tutup app → buka lagi → Library tampil lebih cepat dari sebelumnya.
6. Tekan **Hapus** → angka turun; buka chapter tadi → halaman diunduh ulang (normal).
7. Cek tidak ada regresi: Library/Updates memuat data baru (GraphQL tidak di-cache), bottom nav tetap menempel.

## Rollback

Hapus blok registrasi di `main.tsx` **dan** ganti isi `public/sw.js` dengan:
```js
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.map((k) => caches.delete(k)))).then(() => self.registration.unregister())))
```
(service worker yang sudah terpasang di iPhone harus diganti versi "bunuh diri" ini, tidak cukup dihapus.)
Build → `docker compose restart`.

## Setelah lulus (senior)

- `.agents/nodes/webui.md`: bagian cache — strategi per jenis URL, nama cache, batas; aturan "naikkan `VERSION`
  di `sw.js` bila strategi berubah".
- `.agents/features/reader.md` (preload 6), `status.md`, recap; commit + push.

## Prompt pembuka sesi `agy` (tempel apa adanya)

```
Baca AGENTS.md, .agents/README.md, .agents/rules.md, .agents/nodes/webui.md, lalu .agents/tasks/W-15-service-worker-cache.md.
Semua aturan mengikat. Folder .agents/ read-only.

Task sesi ini: W-15 saja, persis sesuai langkah 1–6 di file task. Tempel kode apa adanya, jangan improvisasi,
jangan ubah file selain yang tercantum, jangan tambah dependency. Jangan commit/push.
Jalankan semua perintah verifikasi langkah 6 dan laporkan output ASLI (format .agents/rules.md §7).
Uji iPhone tandai ⏳. Lalu berhenti.
```

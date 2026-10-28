/*
 * Service worker WebUI Mihon-style (W-15, .agents/decisions.md D-13). Vanilla, tanpa library.
 * - App shell: stale-while-revalidate (buka instan, diperbarui di belakang layar).
 * - Asset ber-hash (/assets/*): cache-first, tidak kedaluwarsa (nama file berubah tiap build).
 * - Halaman chapter, cover, ikon extension: cache-first dengan batas umur & jumlah entri.
 * - GraphQL query (baca data: library, chapter, halaman): stale-while-revalidate,
 *   jadi halaman data tetap terbuka dari cache saat backend mati. PENGECUALIAN:
 *   query progres (ReaderChapter, MangaChapters) network-first — SWR menyajikan
 *   cache basi sebagai respons selesai, sehingga reader mengunci lastPageRead
 *   lama dan membuka ulang dari halaman 1 padahal server sudah punya progres
 *   baru (terbukti 3x pengujian). Offline tetap jatuh ke cache. Mutation
 *   TIDAK di-cache — KECUALI fetchChapterPages: mutation itu hanya membaca
 *   daftar URL halaman (stabil per chapter), dan reader tidak bisa tampil
 *   tanpa daftar itu, jadi responsnya di-cache dengan pola yang sama.
 *   Mutation lain (simpan progres, unduhan, refresh) selalu jaringan.
 *   VERSION sengaja tetap v2: cache gambar yang sudah ada tidak boleh terhapus.
 * - FCM (pengecualian aturan §3, 2026-10-27): handler push chapter baru, digabung ke
 *   file ini karena dua service worker dengan scope yang sama saling menggantikan.
 *   VERSION sengaja tidak naik — strategi cache tidak berubah, jadi cache gambar
 *   tidak ikut terhapus saat service worker diperbarui.
 */
const VERSION = 'v2'
const SHELL = `mihon-shell-${VERSION}`
const PAGES = `mihon-pages-${VERSION}`
const COVERS = `mihon-covers-${VERSION}`
const ICONS = `mihon-icons-${VERSION}`
const API = `mihon-api-${VERSION}`
const ALL = [SHELL, PAGES, COVERS, ICONS, API]

// Jumlah entri maksimum per cache (yang terlama dibuang lebih dulu).
const LIMITS = { [SHELL]: 60, [PAGES]: 1500, [COVERS]: 1000, [ICONS]: 300, [API]: 300 }
// Umur maksimum entri.
const DAY = 24 * 60 * 60 * 1000
const MAX_AGE = { [PAGES]: 30 * DAY, [COVERS]: 30 * DAY, [ICONS]: 30 * DAY, [API]: 30 * DAY }

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
  if (p.includes('/covers-fallback/')) return COVERS
  if (p.includes('/api/v1/extension/icon/')) return ICONS
  if (p.includes('/api/')) return null
  if (p.includes('/assets/')) return 'asset'
  return 'shell'
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  const url = new URL(req.url)
  // GraphQL query (POST) di-cache; mutation lain & upload dilewatkan apa adanya.
  if (req.method === 'POST' && url.origin === self.location.origin && url.pathname.endsWith('/api/graphql')) {
    event.respondWith(graphqlQuery(event, req))
    return
  }
  if (req.method !== 'GET') return
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

/** Kunci cache untuk sebuah query GraphQL: hash isi body (query + variables). */
async function gqlKey(bodyText) {
  if (self.crypto && crypto.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(bodyText))
    const hex = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
    return `${self.location.origin}/__gql__/${hex}`
  }
  let h = 0x811c9dc5
  for (let i = 0; i < bodyText.length; i++) {
    h ^= bodyText.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return `${self.location.origin}/__gql__/${(h >>> 0).toString(16)}`
}

/**
 * Cache untuk GraphQL query (+ mutation fetchChapterPages): segar -> sajikan
 * cache + perbarui di belakang layar; kedaluwarsa -> coba jaringan dulu,
 * jatuh ke cache bila jaringan gagal. Mutation lain tidak pernah sampai sini
 * (difilter di bawah); respons error tidak disimpan.
 */
async function graphqlQuery(event, req) {
  let bodyText
  try {
    bodyText = await req.clone().text()
  } catch (e) {
    return fetch(req)
  }
  let body
  try {
    body = JSON.parse(bodyText)
  } catch (e) {
    return fetch(req) // bukan JSON (mis. multipart upload) -> lewatkan
  }
  const q = typeof body?.query === 'string' ? body.query.trimStart() : ''
  // Yang di-cache: semua query, PLUS mutation fetchChapterPages (daftar URL
  // halaman — hanya membaca, stabil per chapter). Mutation lain punya efek
  // samping (simpan progres, unduhan, refresh) -> selalu jaringan.
  const cacheable = q.startsWith('query') || (q.startsWith('mutation') && q.includes('fetchChapterPages'))
  if (!cacheable) return fetch(req)
  const key = await gqlKey(bodyText)
  const cache = await caches.open(API)
  const hit = await cache.match(key, { ignoreVary: true })
  const network = fetch(req)
    .then(async (res) => {
      if (res.ok) {
        try {
          const json = await res.clone().json()
          if (!json.errors || json.errors.length === 0) {
            event.waitUntil(store(cache, API, key, res.clone()))
          }
        } catch (e) {
          // Bukan JSON: jangan simpan.
        }
      }
      return res
    })
    .catch(() => null)
  // Query progres: network-first. SWR di bawah menyajikan cache basi sebagai
  // respons selesai — React Query menganggapnya data segar, efek posisi awal
  // reader mengunci lastPageRead lama, dan chapter dibuka ulang dari halaman 1
  // walau server sudah menyimpan progres baru. Offline: jatuh ke cache.
  if (/query\s+(ReaderChapter|MangaChapters)\b/.test(q)) {
    const res = await network
    if (res) return res
    if (hit) return hit
    return Response.error()
  }
  if (hit && !isExpired(hit, API)) {
    event.waitUntil(network)
    return hit
  }
  const res = await network
  if (res) return res
  if (hit) return hit // jaringan putus: data kedaluwarsa lebih baik daripada error
  return Response.error()
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

/* ---------- FCM: push chapter baru (pengecualian §3, 2026-10-27) ---------- */

// importScripts dibungkus try/catch: bila gstatic tak terjangkau, blok ini dilewati
// dan fungsi cache di atas tetap jalan normal.
try {
  importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js')
  importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js')
  firebase.initializeApp({
    apiKey: 'AIzaSyCv3UkOtVGQW3raqM3bdirf2o-sbAmFQzM',
    authDomain: 'komik-2a833.firebaseapp.com',
    projectId: 'komik-2a833',
    storageBucket: 'komik-2a833.firebasestorage.app',
    messagingSenderId: '1015246074367',
    appId: '1:1015246074367:web:2bd553b40eb343bdb277ca',
  })
  // Pesan data-only: tampilkan sendiri supaya format & klik konsisten.
  firebase.messaging().onBackgroundMessage((payload) => {
    const d = payload.data || {}
    const icon = new URL('icon-192.png', self.registration.scope).href
    self.registration.showNotification(d.title || 'Chapter baru', {
      body: d.body || '',
      icon,
      // Gambar cover komik (bila ada). Diabaikan platform yang tak mendukungnya.
      image: d.image || undefined,
      data: { url: d.url || '#/updates' },
    })
  })
} catch (e) {
  // FCM nonaktif; cache tetap jalan.
}

// Di luar blok try: klik notifikasi harus jalan walau Firebase gagal dimuat
// (mis. notifikasi dari pesan foreground yang ditampilkan halaman).
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL((event.notification.data && event.notification.data.url) || '#/updates', self.registration.scope).href
  event.waitUntil(
    (async () => {
      const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const c of list) {
        if (c.url.startsWith(self.registration.scope)) {
          try {
            await c.navigate(target)
          } catch (e) {}
          return c.focus()
        }
      }
      return self.clients.openWindow(target)
    })(),
  )
})

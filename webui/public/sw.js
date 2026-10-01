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

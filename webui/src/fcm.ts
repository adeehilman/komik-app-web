/*
 * Notifikasi push chapter baru via Firebase Cloud Messaging (FCM).
 *
 * Pengecualian aturan repo §3 (push notification) diberikan pemilik 2026-10-27.
 * Konfigurasi di bawah adalah konfigurasi klien Firebase (apiKey & VAPID public key
 * memang dirancang untuk tampil di kode klien); yang rahasia — service account —
 * TIDAK ada di sini, melainkan di server pengirim di VPS.
 *
 * Firebase dimuat dari CDN compat (bukan dependency npm) supaya stack terkunci
 * tidak berubah; skrip hanya dimuat saat fitur ini dipakai.
 */

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCv3UkOtVGQW3raqM3bdirf2o-sbAmFQzM',
  authDomain: 'komik-2a833.firebaseapp.com',
  projectId: 'komik-2a833',
  storageBucket: 'komik-2a833.firebasestorage.app',
  messagingSenderId: '1015246074367',
  appId: '1:1015246074367:web:2bd553b40eb343bdb277ca',
}

const VAPID_KEY = 'BI0awZ-wZyVKybkTEI5kxswv-Ly2xjWIeDJe3HWforgl-TtJwQYWeANywfsUumX9qvSSSSOdhbDb7TMq-uwMt1w'
const FIREBASE_VERSION = '10.14.1'

export interface FcmPayload {
  data?: Record<string, string>
  notification?: { title?: string; body?: string }
}

interface CompatMessaging {
  getToken: (options: {
    vapidKey: string
    serviceWorkerRegistration: ServiceWorkerRegistration
  }) => Promise<string>
  deleteToken: () => Promise<boolean>
  onMessage: (handler: (payload: FcmPayload) => void) => void
}

interface CompatFirebase {
  apps: unknown[]
  initializeApp: (config: Record<string, string>) => unknown
  messaging: () => CompatMessaging
}

declare global {
  interface Window {
    firebase?: CompatFirebase
  }
}

let scriptsPromise: Promise<CompatFirebase> | null = null

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('gagal memuat ' + src))
    document.head.appendChild(s)
  })
}

/** Muat Firebase compat sekali, lalu inisialisasi app bila belum. */
async function loadFirebase(): Promise<CompatFirebase> {
  if (!scriptsPromise) {
    scriptsPromise = (async () => {
      if (window.firebase && window.firebase.apps.length > 0) return window.firebase
      await loadScript(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app-compat.js`)
      await loadScript(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-messaging-compat.js`)
      const fb = window.firebase
      if (!fb) throw new Error('Firebase gagal dimuat')
      if (fb.apps.length === 0) fb.initializeApp(FIREBASE_CONFIG)
      return fb
    })()
  }
  return scriptsPromise
}

export function fcmSupported(): boolean {
  return 'Notification' in window && 'serviceWorker' in navigator
}

/**
 * Minta izin + ambil token FCM perangkat ini. Memakai registrasi service worker
 * yang sudah ada (sw.js) — tidak ada service worker kedua.
 */
export async function subscribeFcm(): Promise<string> {
  if (!fcmSupported()) throw new Error('Perangkat ini tidak mendukung push notification')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Izin notifikasi tidak diberikan')
  const fb = await loadFirebase()
  const reg = await navigator.serviceWorker.ready
  return fb.messaging().getToken({ vapidKey: VAPID_KEY, serviceWorkerRegistration: reg })
}

/** Token saat ini tanpa meminta izin (null bila izin belum diberikan). */
export async function getCurrentToken(): Promise<string | null> {
  if (!fcmSupported() || Notification.permission !== 'granted') return null
  const fb = await loadFirebase()
  const reg = await navigator.serviceWorker.ready
  return fb.messaging().getToken({ vapidKey: VAPID_KEY, serviceWorkerRegistration: reg })
}

/**
 * Hapus token perangkat ini dari FCM — tanpa pernah menyentuh service worker
 * default di /firebase-messaging-sw.js.
 *
 * Alasan (bug 2026-10-29): deleteToken() Firebase tanpa registrasi tersimpan
 * memaksa SDK mendaftarkan service worker default itu. Di origin ini file root
 * tersebut tidak bisa disajikan benar lewat funnel (funnel men-strip path
 * /firebase-messaging-sw.js menjadi /, sehingga yang sampai ke browser adalah
 * index.html, bukan JS) → toggle OFF gagal dengan
 * "failed-service-worker-registration" dan token lama tidak pernah terhapus.
 *
 * Jadi: (1) prime dulu dengan getToken + registrasi sw.js yang sudah ada,
 * supaya deleteToken memakai registrasi itu; (2) kalau deleteToken tetap
 * gagal, hapus langganan push browser langsung via pushManager; (3) jangan
 * pernah lempar error dari sini — pemanggil (toggle) tetap harus bisa
 * membersihkan daftar token di server, karena itulah yang dipakai pengirim.
 */
export async function unsubscribeFcm(): Promise<void> {
  if (!fcmSupported()) return
  try {
    const reg = await navigator.serviceWorker.ready
    const fb = await loadFirebase()
    try {
      await fb.messaging().getToken({ vapidKey: VAPID_KEY, serviceWorkerRegistration: reg })
    } catch {
      // Token lama mungkin sudah tidak valid; lanjut ke penghapusan.
    }
    try {
      await fb.messaging().deleteToken()
      return
    } catch {
      // Jatuh ke fallback pushManager di bawah.
    }
    try {
      const sub = await reg.pushManager.getSubscription()
      if (sub) await sub.unsubscribe()
    } catch {
      // Sudah diupayakan; daftar token server tetap dibersihkan pemanggil.
    }
  } catch {
    // Jangan gagalkan toggle OFF karena urusan FCM di browser.
  }
}

let foregroundInit = false

/** Saat aplikasi terbuka, tampilkan pesan masuk sebagai notifikasi sistem. */
export async function initForegroundMessages(): Promise<void> {
  if (foregroundInit || !fcmSupported() || Notification.permission !== 'granted') return
  foregroundInit = true
  const fb = await loadFirebase()
  fb.messaging().onMessage((payload) => {
    const d = payload.data ?? {}
    const title = d.title ?? payload.notification?.title ?? 'Chapter baru'
    const body = d.body ?? payload.notification?.body ?? ''
    void navigator.serviceWorker.ready.then((reg) =>
      reg.showNotification(title, {
        body,
        icon: new URL('icon-192.png', document.baseURI).href,
        // Spread (bukan properti langsung) supaya TS lib lama yang belum
        // mengenal NotificationOptions.image tidak menolak kompilasi.
        ...(d.image ? { image: d.image } : {}),
        data: { url: d.url ?? '#/updates' },
      }),
    )
  })
}

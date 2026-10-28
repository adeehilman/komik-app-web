import { useEffect, useState } from 'react'

/** Pemakaian & penghapusan cache service worker di perangkat ini (W-15). */
const IMAGE_CACHE_PREFIXES = ['mihon-pages-', 'mihon-covers-', 'mihon-icons-']

function formatMB(bytes: number): string {
  return `${Math.round(bytes / 1024 / 1024)} MB`
}

export function DeviceStorage() {
  const [usage, setUsage] = useState('menghitung…')
  const [persisted, setPersisted] = useState<boolean | null>(null)
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
    try {
      const p = await navigator.storage?.persisted?.()
      if (typeof p === 'boolean') setPersisted(p)
    } catch {
      // Abaikan: status persisten hanya info tambahan.
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
            {persisted === true ? ' · persisten' : persisted === false ? ' · bisa dihapus sistem bila penuh' : ''}
          </span>
        </span>
        <button type="button" className="btn btn-text" disabled={busy || !supported} onClick={clear}>
          Hapus
        </button>
      </div>
    </>
  )
}

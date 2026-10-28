import { useEffect, useState } from 'react'
import { cancelDownload, startDownload, useDownloadState } from '../api/downloadManager'

/** Pemakaian & penghapusan cache service worker di perangkat ini (W-15). */
const IMAGE_CACHE_PREFIXES = ['mihon-pages-', 'mihon-covers-', 'mihon-icons-']

function formatMB(bytes: number): string {
  return `${Math.round(bytes / 1024 / 1024)} MB`
}

export function DeviceStorage() {
  const [usage, setUsage] = useState('menghitung…')
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  // State unduhan dibaca dari manajer global: tetap live walau komponen ini
  // sempat tidak tampil (pengguna pindah halaman lalu kembali).
  const dl = useDownloadState()
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

  // Setelah unduhan selesai, perbarui angka pemakaian.
  useEffect(() => {
    if (dl.status === 'done') refresh()
  }, [dl.status])

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

  const running = dl.status === 'running'
  const pct = dl.total > 0 ? Math.round((dl.done / dl.total) * 100) : 0
  const dlSubtitle =
    dl.status === 'running'
      ? `Mengunduh cover ${dl.done}/${dl.total} · ${formatMB(dl.bytes)} · ${pct}%`
      : dl.status === 'done'
        ? `Selesai: ${dl.total - dl.failed}/${dl.total} cover · ${formatMB(dl.bytes)}` +
          (dl.failed > 0 ? ` · ${dl.failed} gagal (dicoba lagi saat dibuka)` : '')
        : dl.status === 'cancelled'
          ? `Dibatalkan (${dl.done}/${dl.total} terunduh) — ketuk Unduh untuk melanjutkan dari sisanya.`
          : dl.error ?? 'Simpan semua cover library ke perangkat (±40 MB). Sekali tersimpan, cover tidak ikut terhapus saat aplikasi diperbarui.'

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
      <div>
        <div className="list-item">
          <span className="list-item-text">
            <span className="list-item-title">Unduh semua cover</span>
            <span className="list-item-subtitle">{dlSubtitle}</span>
          </span>
          {running ? (
            <button type="button" className="btn btn-text" disabled={!supported} onClick={cancelDownload}>
              Batal
            </button>
          ) : (
            <button type="button" className="btn btn-text" disabled={!supported || !active} onClick={() => void startDownload()}>
              Unduh
            </button>
          )}
        </div>
        {(running || dl.status === 'done' || dl.status === 'cancelled') && dl.total > 0 && (
          <div style={{ height: 8, background: '#333', borderRadius: 4, margin: '2px 0 10px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: '#1e88e5', borderRadius: 4 }} />
          </div>
        )}
      </div>
    </>
  )
}

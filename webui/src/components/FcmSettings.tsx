import { useEffect, useState } from 'react'
import { useSetting } from '../settings/useSetting'
import { fcmSupported, getCurrentToken, initForegroundMessages, subscribeFcm, unsubscribeFcm } from '../fcm'

/*
 * Toggle langganan push chapter baru (FCM). Token perangkat disimpan di meta
 * server `mihonweb_fcm_tokens` (array JSON) supaya dibaca pengirim di VPS.
 * Satu pengguna = satu perangkat, jadi mematikan toggle menghapus seluruh daftar.
 */

function parseTokens(raw: string): string[] {
  try {
    const v: unknown = JSON.parse(raw)
    return Array.isArray(v) ? v.filter((t): t is string => typeof t === 'string') : []
  } catch {
    return []
  }
}

export function FcmSettings() {
  const [rawTokens, setTokens] = useSetting('mihonweb_fcm_tokens')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const supported = fcmSupported()
  const tokens = parseTokens(rawTokens)
  const active = tokens.length > 0

  useEffect(() => {
    void initForegroundMessages().catch(() => {})
  }, [])

  // Sekali saat dibuka: sinkronkan token bila FCM merotasinya.
  useEffect(() => {
    if (!active) return
    let cancelled = false
    void getCurrentToken()
      .then((token) => {
        if (cancelled || !token) return
        const list = parseTokens(rawTokens)
        if (!list.includes(token)) void setTokens(JSON.stringify([token])).catch(() => {})
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
    // Sengaja hanya saat mount: daftar token tidak berubah dari luar halaman ini.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggle = async (on: boolean) => {
    setBusy(true)
    setError('')
    try {
      if (on) {
        const token = await subscribeFcm()
        const list = parseTokens(rawTokens)
        if (!list.includes(token)) await setTokens(JSON.stringify([...list, token]))
      } else {
        await unsubscribeFcm()
        await setTokens(JSON.stringify([]))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengubah setelan notifikasi')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="section-title">Notifikasi</div>
      <label className="list-item">
        <span className="list-item-text">
          <span className="list-item-title">Notifikasi chapter baru</span>
          <span className="list-item-subtitle">
            {!supported
              ? 'Perangkat ini tidak mendukung push notification'
              : active
                ? 'Aktif di perangkat ini — push dikirim tiap ada chapter baru di library'
                : 'Kirim push tiap ada chapter baru di library. Di iPhone, buka dari ikon Home Screen.'}
          </span>
        </span>
        <input
          type="checkbox"
          disabled={!supported || busy}
          checked={active}
          onChange={(e) => void toggle(e.target.checked)}
        />
      </label>
      {error && <div className="error-text">{error}</div>}
    </>
  )
}

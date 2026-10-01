import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchLastUpdateTimestamp, fetchUpdateSettings, saveUpdateSettings } from '../api/updates'
import type { UpdateSettings } from '../api/updates'
import { TopBar } from '../components/TopBar'
import { useSetting } from '../settings/useSetting'
import type { SettingsSchema } from '../settings/schema'
import { DeviceStorage } from '../components/DeviceStorage'

/*
 * Update library berjalan di SERVER (tetap jalan walau iPhone mati).
 * Nilai disimpan lewat `setSettings`, bukan env var: env UPDATE_* / AUTO_DOWNLOAD_* akan
 * menimpa setelan ini tiap container restart (.agents/features/auto-update.md).
 */

const INTERVALS: Array<[number, string]> = [
  [0, 'Mati'],
  [6, 'Tiap 6 jam'],
  [12, 'Tiap 12 jam'],
  [24, 'Harian'],
  [48, 'Tiap 2 hari'],
  [72, 'Tiap 3 hari'],
  [168, 'Mingguan'],
]

const READER_MODES: Array<[SettingsSchema['mihonweb_reader_mode'], string]> = [
  ['rtl', 'Kanan ke kiri'],
  ['ltr', 'Kiri ke kanan'],
  ['vertical', 'Vertikal'],
  ['webtoon', 'Webtoon'],
]

export function SettingsPage() {
  const queryClient = useQueryClient()
  const settings = useQuery({ queryKey: ['serverSettings'], queryFn: fetchUpdateSettings })
  const lastUpdate = useQuery({ queryKey: ['lastUpdateTimestamp'], queryFn: fetchLastUpdateTimestamp })
  const [readerMode, setReaderMode] = useSetting('mihonweb_reader_mode')

  const save = useMutation({
    mutationFn: saveUpdateSettings,
    onMutate: async (patch: Partial<UpdateSettings>) => {
      const previous = queryClient.getQueryData<UpdateSettings>(['serverSettings'])
      if (previous) queryClient.setQueryData(['serverSettings'], { ...previous, ...patch })
      return { previous }
    },
    onError: (_e, _patch, ctx) => ctx?.previous && queryClient.setQueryData(['serverSettings'], ctx.previous),
    onSuccess: (fresh) => queryClient.setQueryData(['serverSettings'], fresh),
  })

  const s = settings.data
  const check = (key: keyof UpdateSettings, title: string, subtitle?: string) =>
    s && (
      <label className="list-item">
        <span className="list-item-text">
          <span className="list-item-title">{title}</span>
          {subtitle && <span className="list-item-subtitle">{subtitle}</span>}
        </span>
        <input type="checkbox" checked={Boolean(s[key])} onChange={(e) => save.mutate({ [key]: e.target.checked })} />
      </label>
    )

  // Nilai interval server bisa di luar daftar (mis. 36) — tetap tampilkan.
  const intervalOptions =
    s && !INTERVALS.some(([v]) => v === s.globalUpdateInterval)
      ? [...INTERVALS, [s.globalUpdateInterval, `${s.globalUpdateInterval} jam`] as [number, string]]
      : INTERVALS

  const last = lastUpdate.data ? new Date(lastUpdate.data).toLocaleString('id-ID') : 'belum pernah'

  return (
    <div>
      <TopBar back title="Settings" />
      {settings.isLoading && <div className="spinner" />}
      {settings.error && <div className="error-text">{(settings.error as Error).message}</div>}
      {save.error && <div className="error-text">Gagal menyimpan: {(save.error as Error).message}</div>}

      {s && (
        <>
          <div className="section-title">Library — Global update</div>
          <label className="list-item">
            <span className="list-item-text">
              <span className="list-item-title">Update otomatis</span>
              <span className="list-item-subtitle">Berjalan di server. Terakhir: {last}</span>
            </span>
            <select
              value={s.globalUpdateInterval}
              onChange={(e) => save.mutate({ globalUpdateInterval: Number(e.target.value) })}
            >
              {intervalOptions.map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {check('excludeUnreadChapters', 'Lewati yang punya chapter belum dibaca')}
          {check('excludeNotStarted', 'Lewati yang belum mulai dibaca')}
          {check('excludeCompleted', 'Lewati yang statusnya completed')}
          {check('updateMangas', 'Perbarui info manga', 'Cover dan deskripsi ikut diperbarui')}

          <div className="section-title">Download</div>
          {check('autoDownloadNewChapters', 'Unduh otomatis chapter baru')}
          {s.autoDownloadNewChapters && (
            <>
              {check('excludeEntryWithUnreadChapters', 'Kecuali manga yang punya chapter belum dibaca')}
              <label className="list-item">
                <span className="list-item-text">
                  <span className="list-item-title">Batas chapter per update</span>
                  <span className="list-item-subtitle">0 = tanpa batas</span>
                </span>
                <select
                  value={s.autoDownloadNewChaptersLimit}
                  onChange={(e) => save.mutate({ autoDownloadNewChaptersLimit: Number(e.target.value) })}
                >
                  {[0, 1, 2, 3, 5, 10].map((n) => (
                    <option key={n} value={n}>
                      {n === 0 ? 'Tanpa batas' : n}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
        </>
      )}

      <div className="section-title">Reader</div>
      <label className="list-item">
        <span className="list-item-text">
          <span className="list-item-title">Mode baca default</span>
          <span className="list-item-subtitle">Bisa diganti per judul dari menu reader</span>
        </span>
        <select value={readerMode} onChange={(e) => setReaderMode(e.target.value as SettingsSchema['mihonweb_reader_mode'])}>
          {READER_MODES.map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <DeviceStorage />
    </div>
  )
}

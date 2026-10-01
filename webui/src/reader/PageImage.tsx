import { useState } from 'react'

/** Satu gambar halaman: spinner saat memuat, tombol coba lagi kalau gagal. */
export function PageImage({
  src,
  className,
  eager,
  onLoad,
}: {
  src: string
  className?: string
  eager?: boolean
  onLoad?: () => void
}) {
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading')
  const [attempt, setAttempt] = useState(0)
  const url = attempt === 0 ? src : `${src}${src.includes('?') ? '&' : '?'}retry=${attempt}`

  return (
    <div className={`page-image ${state} ${className ?? ''}`}>
      {state !== 'error' && (
        <img
          key={url}
          src={url}
          alt=""
          draggable={false}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={() => {
            setState('ok')
            onLoad?.()
          }}
          onError={() => setState('error')}
        />
      )}
      {state === 'loading' && <div className="spinner page-spinner" />}
      {state === 'error' && (
        <div className="page-error">
          <span>Gagal memuat halaman</span>
          <button
            type="button"
            className="btn btn-tonal"
            onClick={(e) => {
              e.stopPropagation()
              setState('loading')
              setAttempt((a) => a + 1)
            }}
          >
            Coba lagi
          </button>
        </div>
      )}
    </div>
  )
}

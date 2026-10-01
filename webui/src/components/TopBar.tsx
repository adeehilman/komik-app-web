import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from './Icon'
import './TopBar.css'

interface TopBarProps {
  title: ReactNode
  subtitle?: ReactNode
  /** true = tombol kembali memakai riwayat browser; string = path tujuan. */
  back?: boolean | string
  actions?: ReactNode
  /** Mengganti seluruh isi bar (mis. kotak pencarian). */
  children?: ReactNode
  /** Konten di bawah bar, ikut menempel (tab, progress bar). */
  below?: ReactNode
}

export function TopBar({ title, subtitle, back, actions, children, below }: TopBarProps) {
  const navigate = useNavigate()

  const goBack = () => {
    if (typeof back === 'string') navigate(back)
    else if (window.history.length > 1) navigate(-1)
    else navigate('/')
  }

  return (
    <header className="top-bar">
      <div className="top-bar-content">
        {children ?? (
          <>
            {back && (
              <button type="button" className="icon-btn" onClick={goBack} aria-label="Kembali">
                <Icon name="back" />
              </button>
            )}
            <div className="top-bar-titles">
              <h1 className="top-bar-title">{title}</h1>
              {subtitle && <span className="top-bar-subtitle">{subtitle}</span>}
            </div>
            {actions && <div className="top-bar-actions">{actions}</div>}
          </>
        )}
      </div>
      {below}
    </header>
  )
}

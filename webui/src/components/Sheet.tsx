import type { ReactNode } from 'react'
import './Sheet.css'

interface SheetProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  /** Header tetap (mis. tab) di atas konten yang bisa digulir. */
  header?: ReactNode
}

/** Bottom sheet ala Material 3 (dipakai filter Library, menu reader, dsb.). */
export function Sheet({ open, onClose, children, header }: SheetProps) {
  if (!open) return null
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        {header}
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  )
}

interface DialogProps {
  open: boolean
  title: ReactNode
  onClose: () => void
  children?: ReactNode
  actions?: ReactNode
}

export function Dialog({ open, title, onClose, children, actions }: DialogProps) {
  if (!open) return null
  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" role="dialog" onClick={(e) => e.stopPropagation()}>
        <h2 className="dialog-title">{title}</h2>
        {children && <div className="dialog-body">{children}</div>}
        {actions && <div className="dialog-actions">{actions}</div>}
      </div>
    </div>
  )
}

import { useQuery } from '@tanstack/react-query'
import { NavLink } from 'react-router-dom'
import { countNewChapters } from '../api/updates'
import { useSetting } from '../settings/useSetting'
import './BottomNav.css'

const ICONS = {
  library:
    'M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12z',
  updates:
    'M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z',
  history:
    'M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z',
  browse:
    'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z',
  more: 'M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z',
}

const TABS: Array<{ to: string; label: string; icon: keyof typeof ICONS }> = [
  { to: '/', label: 'Library', icon: 'library' },
  { to: '/updates', label: 'Updates', icon: 'updates' },
  { to: '/history', label: 'History', icon: 'history' },
  { to: '/browse', label: 'Browse', icon: 'browse' },
  { to: '/more', label: 'More', icon: 'more' },
]

export function BottomNav() {
  const [lastSeen] = useSetting('mihonweb_updates_last_seen')
  const { data: newCount } = useQuery({
    queryKey: ['newChapterCount', lastSeen],
    queryFn: () => countNewChapters(lastSeen),
    // 0 = tab Updates belum pernah dibuka; jangan tampilkan semua chapter lama sebagai "baru".
    enabled: lastSeen > 0,
    refetchInterval: 5 * 60 * 1000,
  })

  return (
    <nav className="bottom-nav">
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.to === '/'}
          className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
        >
          <div className="bottom-nav-icon-container">
            <svg className="bottom-nav-icon" viewBox="0 0 24 24">
              <path d={ICONS[tab.icon]} />
            </svg>
            {tab.icon === 'updates' && !!newCount && (
              <span className="bottom-nav-badge">{newCount > 99 ? '99+' : newCount}</span>
            )}
          </div>
          <span>{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

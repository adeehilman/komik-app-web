import { useLayoutEffect } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation, useNavigationType } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BottomNav } from './components/BottomNav'
import { LibraryPage } from './pages/Library'
import { UpdatesPage } from './pages/Updates'
import { HistoryPage } from './pages/History'
import { BrowsePage } from './pages/Browse'
import { SourceBrowsePage } from './pages/SourceBrowse'
import { MangaPage } from './pages/Manga'
import { ReaderRoute } from './pages/Reader'
import { MorePage } from './pages/More'
import { SettingsPage } from './pages/Settings'
import { BackupPage } from './pages/Backup'
import './theme/tokens.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

/** Bottom nav hanya di 5 layar utama, seperti Mihon. */
const ROOT_TABS = ['/', '/updates', '/history', '/browse', '/more']

/** Posisi scroll #root per entri riwayat: halaman baru mulai di atas, tombol kembali memulihkan. */
const scrollPositions = new Map<string, number>()

function useScrollRestoration() {
  const location = useLocation()
  const navType = useNavigationType()
  useLayoutEffect(() => {
    const root = document.getElementById('root')
    if (!root) return
    root.scrollTop = navType === 'POP' ? (scrollPositions.get(location.key) ?? 0) : 0
    const save = () => scrollPositions.set(location.key, root.scrollTop)
    root.addEventListener('scroll', save, { passive: true })
    return () => root.removeEventListener('scroll', save)
  }, [location.key, navType])
}

function Shell() {
  const { pathname } = useLocation()
  useScrollRestoration()
  const showNav = ROOT_TABS.includes(pathname)
  return (
    <div className={showNav ? 'app with-nav' : 'app'}>
      <Routes>
        <Route path="/" element={<LibraryPage />} />
        <Route path="/library" element={<Navigate to="/" replace />} />
        <Route path="/updates" element={<UpdatesPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/browse" element={<BrowsePage />} />
        <Route path="/browse/source/:sourceId" element={<SourceBrowsePage />} />
        <Route path="/manga/:mangaId" element={<MangaPage />} />
        <Route path="/reader/:chapterId" element={<ReaderRoute />} />
        <Route path="/more" element={<MorePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/backup" element={<BackupPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {showNav && <BottomNav />}
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <Shell />
      </HashRouter>
    </QueryClientProvider>
  )
}

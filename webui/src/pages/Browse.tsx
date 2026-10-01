import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { fetchSources } from '../api/source'
import type { SourceItem } from '../api/source'
import { changeExtension, fetchExtensions, refreshExtensionStore } from '../api/extension'
import type { ExtensionAction, ExtensionItem } from '../api/extension'
import { TopBar } from '../components/TopBar'
import { Icon } from '../components/Icon'
import { useSetting } from '../settings/useSetting'
import './Browse.css'

const LOCAL_SOURCE_ID = '0'
const MAX_AVAILABLE_ROWS = 150

function langName(code: string): string {
  if (code === 'all') return 'Multi'
  if (code === 'localsourcelang') return 'Lainnya'
  try {
    return new Intl.DisplayNames(['id'], { type: 'language' }).of(code) ?? code.toUpperCase()
  } catch {
    return code.toUpperCase()
  }
}

function SourcesTab() {
  const { data, isLoading, error } = useQuery({ queryKey: ['sources'], queryFn: fetchSources })

  const groups = useMemo(() => {
    const map = new Map<string, SourceItem[]>()
    for (const s of data ?? []) {
      const key = s.id === LOCAL_SOURCE_ID ? 'localsourcelang' : s.lang
      map.set(key, [...(map.get(key) ?? []), s])
    }
    return [...map.entries()].sort(([a], [b]) =>
      a === 'localsourcelang' ? 1 : b === 'localsourcelang' ? -1 : langName(a).localeCompare(langName(b)),
    )
  }, [data])

  if (isLoading) return <div className="spinner" />
  if (error) return <div className="error-text">{(error as Error).message}</div>
  if (groups.length === 0 || (groups.length === 1 && groups[0][0] === 'localsourcelang'))
    return (
      <div className="empty-state">
        <span className="empty-face">(･o･;)</span>
        <span>Belum ada source. Pasang extension di tab Extensions.</span>
      </div>
    )

  return (
    <>
      {groups.map(([lang, sources]) => (
        <section key={lang}>
          <div className="section-title">{langName(lang)}</div>
          {sources.map((s) => (
            <div key={s.id} className="list-item source-row">
              <Link to={`/browse/source/${s.id}`} className="source-link">
                <img className="source-icon" src={s.iconUrl} alt="" loading="lazy" />
                <span className="list-item-text">
                  <span className="list-item-title">{s.name}</span>
                  {s.isNsfw && <span className="list-item-subtitle">18+</span>}
                </span>
              </Link>
              {s.supportsLatest && (
                <Link to={`/browse/source/${s.id}?type=LATEST`} className="btn btn-text">
                  Latest
                </Link>
              )}
            </div>
          ))}
        </section>
      ))}
    </>
  )
}

function ExtensionsTab() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [langSetting, setLangSetting] = useSetting('mihonweb_browse_langs')
  const [showAll, setShowAll] = useState(false)
  const langs = useMemo(() => new Set(langSetting.split(',').filter(Boolean)), [langSetting])
  const { data, isLoading, error } = useQuery({ queryKey: ['extensions'], queryFn: fetchExtensions })

  const refresh = useMutation({
    mutationFn: refreshExtensionStore,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['extensions'] }),
  })
  const [pending, setPending] = useState<string | null>(null)
  const act = async (ext: ExtensionItem, action: ExtensionAction) => {
    if (action === 'uninstall' && !window.confirm(`Uninstall ${ext.name}?`)) return
    setPending(ext.pkgName)
    try {
      await changeExtension(ext.pkgName, action)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['extensions'] }),
        queryClient.invalidateQueries({ queryKey: ['sources'] }),
      ])
    } catch (e) {
      window.alert(`Gagal ${action}: ${(e as Error).message}`)
    } finally {
      setPending(null)
    }
  }

  const allLangs = useMemo(
    () => [...new Set((data ?? []).map((e) => e.lang))].sort((a, b) => langName(a).localeCompare(langName(b))),
    [data],
  )
  const toggleLang = (lang: string) => {
    const next = new Set(langs)
    if (next.has(lang)) next.delete(lang)
    else next.add(lang)
    setLangSetting([...next].join(','))
  }

  const q = search.trim().toLowerCase()
  const match = (e: ExtensionItem) => !q || e.name.toLowerCase().includes(q)
  const updates = (data ?? []).filter((e) => e.isInstalled && (e.hasUpdate || e.isObsolete) && match(e))
  const installed = (data ?? []).filter((e) => e.isInstalled && !e.hasUpdate && !e.isObsolete && match(e))
  const available = (data ?? []).filter((e) => !e.isInstalled && langs.has(e.lang) && match(e))

  const row = (ext: ExtensionItem) => {
    const action: ExtensionAction | null = !ext.isInstalled ? 'install' : ext.hasUpdate ? 'update' : null
    return (
      <div key={ext.pkgName} className="list-item">
        <img className="source-icon" src={ext.iconUrl} alt="" loading="lazy" />
        <span className="list-item-text">
          <span className="list-item-title">{ext.name}</span>
          <span className="list-item-subtitle">
            {langName(ext.lang)} · {ext.versionName}
            {ext.isNsfw && <span className="nsfw"> 18+</span>}
            {ext.isObsolete && <span className="nsfw"> Obsolete</span>}
          </span>
        </span>
        {pending === ext.pkgName ? (
          <span className="spinner small" />
        ) : (
          <>
            {action && (
              <button type="button" className="btn btn-text" onClick={() => act(ext, action)}>
                {action === 'install' ? 'Install' : 'Update'}
              </button>
            )}
            {ext.isInstalled && (
              <button type="button" className="icon-btn" aria-label="Uninstall" onClick={() => act(ext, 'uninstall')}>
                <Icon name="delete" size={20} />
              </button>
            )}
          </>
        )}
      </div>
    )
  }

  return (
    <>
      <div className="ext-toolbar">
        <input
          className="top-bar-search"
          placeholder="Cari extension…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          type="button"
          className="icon-btn"
          aria-label="Perbarui daftar dari repo"
          disabled={refresh.isPending}
          onClick={() => refresh.mutate()}
        >
          <Icon name="refresh" />
        </button>
      </div>
      <div className="chip-row">
        {allLangs.map((l) => (
          <button key={l} type="button" className={`chip ${langs.has(l) ? 'active' : ''}`} onClick={() => toggleLang(l)}>
            {langName(l)}
          </button>
        ))}
      </div>
      {refresh.isPending && <div className="progress-bar indeterminate"><div className="progress-bar-fill" /></div>}
      {isLoading && <div className="spinner" />}
      {error && <div className="error-text">{(error as Error).message}</div>}
      {updates.length > 0 && (
        <>
          <div className="section-title">Update tersedia</div>
          {updates.map(row)}
        </>
      )}
      {installed.length > 0 && (
        <>
          <div className="section-title">Terpasang</div>
          {installed.map(row)}
        </>
      )}
      {available.length > 0 && (
        <>
          <div className="section-title">Tersedia ({available.length})</div>
          {(showAll ? available : available.slice(0, MAX_AVAILABLE_ROWS)).map(row)}
          {!showAll && available.length > MAX_AVAILABLE_ROWS && (
            <div className="load-more">
              <button type="button" className="btn btn-tonal" onClick={() => setShowAll(true)}>
                Tampilkan semua
              </button>
            </div>
          )}
        </>
      )}
    </>
  )
}

export function BrowsePage() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'extensions' ? 'extensions' : 'sources'
  const setTab = (t: string) => setParams(t === 'sources' ? {} : { tab: t }, { replace: true })

  return (
    <div className="browse-page">
      <TopBar
        title="Browse"
        below={
          <div className="tabs">
            <button type="button" className={`tab ${tab === 'sources' ? 'active' : ''}`} onClick={() => setTab('sources')}>
              Sources
            </button>
            <button
              type="button"
              className={`tab ${tab === 'extensions' ? 'active' : ''}`}
              onClick={() => setTab('extensions')}
            >
              Extensions
            </button>
          </div>
        }
      />
      {tab === 'sources' ? <SourcesTab /> : <ExtensionsTab />}
    </div>
  )
}

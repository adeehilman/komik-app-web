import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { gql } from '../api/client'
import { TopBar } from '../components/TopBar'
import { Icon } from '../components/Icon'
import type { IconName } from '../components/Icon'
import './More.css'

interface AboutServerData {
  aboutServer: { name: string; version: string; buildType: string }
}

const ITEMS: Array<{ to: string; icon: IconName; title: string; subtitle: string }> = [
  { to: '/settings', icon: 'settings', title: 'Settings', subtitle: 'Update otomatis, download, reader' },
  { to: '/backup', icon: 'backup', title: 'Backup & restore', subtitle: 'Buat file .tachibk atau pulihkan' },
]

export function MorePage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['aboutServer'],
    queryFn: () => gql<AboutServerData>('query AboutServer { aboutServer { name version buildType } }'),
  })

  return (
    <div className="more-page">
      <TopBar title="More" />
      <div className="more-logo">
        <span className="more-logo-mark">M</span>
      </div>
      {ITEMS.map((item) => (
        <Link key={item.to} to={item.to} className="list-item">
          <span className="list-item-icon">
            <Icon name={item.icon} />
          </span>
          <span className="list-item-text">
            <span className="list-item-title">{item.title}</span>
            <span className="list-item-subtitle">{item.subtitle}</span>
          </span>
        </Link>
      ))}
      <div className="list-item">
        <span className="list-item-icon">
          <Icon name="info" />
        </span>
        <span className="list-item-text">
          <span className="list-item-title">About</span>
          <span className="list-item-subtitle more-about-server">
            {isLoading && 'Menghubungi server…'}
            {error && `Error: ${(error as Error).message}`}
            {data && `${data.aboutServer.name} ${data.aboutServer.version} (${data.aboutServer.buildType})`}
          </span>
        </span>
      </div>
    </div>
  )
}

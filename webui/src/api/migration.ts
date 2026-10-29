import { gql } from './client'
import type { MangaItem } from './library'

/*
 * Migrasi (v1: kelola judul ganda).
 * Menampilkan judul yang punya >1 entri di library (komik yang sama dari
 * sumber berbeda) supaya entri yang tidak diinginkan bisa disembunyikan, plus
 * daftar entri yang pernah disembunyikan supaya bisa dikembalikan.
 *
 * Field manga = field yang sama dengan query Library (library.ts); tidak ada
 * field GraphQL baru yang ditebak. Menyembunyikan = setMangasInLibrary(false):
 * entri keluar dari Library, tab Updates, badge, dan update otomatis — tapi
 * progres baca tetap tersimpan di server dan bisa dikembalikan kapan saja.
 */

const MANGA_FIELDS = `
  id title thumbnailUrl inLibrary inLibraryAt status
  unreadCount downloadCount bookmarkCount
  chapters { totalCount }
  firstUnreadChapter { id }
  latestReadChapter { id lastReadAt }
  latestFetchedChapter { fetchedAt }
  latestUploadedChapter { uploadDate }
  categories { nodes { id } }
  source { id displayName lang }
`

export interface MigrationData {
  library: MangaItem[]
  nonLibrary: MangaItem[]
}

export async function fetchMigrationData(): Promise<MigrationData> {
  const data = await gql<{ lib: { nodes: MangaItem[] }; nonlib: { nodes: MangaItem[] } }>(`
    query Migration {
      lib: mangas(condition: { inLibrary: true }) { nodes { ${MANGA_FIELDS} } }
      nonlib: mangas(condition: { inLibrary: false }) { nodes { ${MANGA_FIELDS} } }
    }
  `)
  return { library: data.lib.nodes, nonLibrary: data.nonlib.nodes }
}

/**
 * Normalisasi judul untuk pengelompokan: huruf kecil, hanya alfanumerik.
 * Menyatukan beda kapitalisasi & tanda baca (' vs ’, spasi, dsb).
 */
export function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export interface DuplicateGroup {
  key: string
  title: string
  library: MangaItem[]
  hidden: MangaItem[]
}

/**
 * Kelompokkan semua entri per judul ternormalisasi. Hanya grup ganda yang
 * dikembalikan (total entri >= 2): grup dengan >=2 entri library masuk
 * bagian utama; entri non-library di grup ganda masuk bagian disembunyikan
 * (termasuk pasangan yang keduanya sudah disembunyikan).
 */
export function groupDuplicates(data: MigrationData): DuplicateGroup[] {
  const map = new Map<string, DuplicateGroup>()
  const put = (m: MangaItem) => {
    const key = normalizeTitle(m.title)
    if (!key) return
    let g = map.get(key)
    if (!g) {
      g = { key, title: m.title, library: [], hidden: [] }
      map.set(key, g)
    }
    if (m.inLibrary) g.library.push(m)
    else g.hidden.push(m)
  }
  for (const m of data.library) put(m)
  for (const m of data.nonLibrary) put(m)
  const groups = [...map.values()].filter((g) => g.library.length + g.hidden.length >= 2)
  groups.sort((a, b) => a.title.localeCompare(b.title))
  return groups
}

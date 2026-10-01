import { gql } from './client'
import { CHAPTER_FIELDS } from './chapter'
import type { ChapterItem } from './chapter'

/* ---------- Daftar chapter terbaru (tab Updates) ---------- */

export interface UpdateEntry extends ChapterItem {
  manga: { id: number; title: string; thumbnailUrl: string | null }
}

export const UPDATES_PAGE_SIZE = 50

export async function fetchRecentChapters(offset: number): Promise<{ items: UpdateEntry[]; hasNextPage: boolean }> {
  const data = await gql<{ chapters: { nodes: UpdateEntry[]; pageInfo: { hasNextPage: boolean } } }>(
    `query RecentChapters($first: Int!, $offset: Int!) {
      chapters(
        filter: { inLibrary: { equalTo: true } }
        order: [{ by: FETCHED_AT, byType: DESC }, { by: SOURCE_ORDER, byType: DESC }]
        first: $first
        offset: $offset
      ) {
        nodes { ${CHAPTER_FIELDS} manga { id title thumbnailUrl } }
        pageInfo { hasNextPage }
      }
    }`,
    { first: UPDATES_PAGE_SIZE, offset },
  )
  return { items: data.chapters.nodes, hasNextPage: data.chapters.pageInfo.hasNextPage }
}

/** Jumlah chapter library yang di-fetch setelah `sinceSeconds` (badge tab Updates). */
export async function countNewChapters(sinceSeconds: number): Promise<number> {
  const data = await gql<{ chapters: { totalCount: number } }>(
    `query NewChapterCount($since: LongString!) {
      chapters(filter: { inLibrary: { equalTo: true }, fetchedAt: { greaterThan: $since }, isRead: { equalTo: false } }) {
        totalCount
      }
    }`,
    { since: String(sinceSeconds) },
  )
  return data.chapters.totalCount
}

/* ---------- Update library (berjalan di server) ---------- */

export interface LibraryUpdateJobs {
  isRunning: boolean
  totalJobs: number
  finishedJobs: number
}

export async function fetchLibraryUpdateStatus(): Promise<LibraryUpdateJobs> {
  const data = await gql<{ libraryUpdateStatus: { jobsInfo: LibraryUpdateJobs } }>(`
    query LibraryUpdateStatus {
      libraryUpdateStatus { jobsInfo { isRunning totalJobs finishedJobs } }
    }
  `)
  return data.libraryUpdateStatus.jobsInfo
}

/** Tanpa kategori = seluruh library. */
export async function startLibraryUpdate(categoryIds?: number[]): Promise<void> {
  if (categoryIds && categoryIds.length > 0) {
    await gql(
      `mutation UpdateCategoryManga($input: UpdateCategoryMangaInput!) {
        updateCategoryManga(input: $input) { clientMutationId }
      }`,
      { input: { categories: categoryIds } },
    )
    return
  }
  await gql(
    `mutation UpdateLibrary($input: UpdateLibraryInput!) {
      updateLibrary(input: $input) { clientMutationId }
    }`,
    { input: {} },
  )
}

export async function stopLibraryUpdate(): Promise<void> {
  await gql(`mutation UpdateStop($input: UpdateStopInput!) { updateStop(input: $input) { clientMutationId } }`, {
    input: {},
  })
}

export async function fetchLastUpdateTimestamp(): Promise<number> {
  const data = await gql<{ lastUpdateTimestamp: { timestamp: string } }>(
    `query LastUpdate { lastUpdateTimestamp { timestamp } }`,
  )
  return Number(data.lastUpdateTimestamp.timestamp) || 0
}

/* ---------- Setelan server untuk update otomatis (W-12) ---------- */

export interface UpdateSettings {
  globalUpdateInterval: number
  excludeUnreadChapters: boolean
  excludeNotStarted: boolean
  excludeCompleted: boolean
  updateMangas: boolean
  autoDownloadNewChapters: boolean
  excludeEntryWithUnreadChapters: boolean
  autoDownloadNewChaptersLimit: number
}

const SETTINGS_FIELDS = `
  globalUpdateInterval excludeUnreadChapters excludeNotStarted excludeCompleted updateMangas
  autoDownloadNewChapters excludeEntryWithUnreadChapters autoDownloadNewChaptersLimit
`

export async function fetchUpdateSettings(): Promise<UpdateSettings> {
  const data = await gql<{ settings: UpdateSettings }>(`query UpdateSettings { settings { ${SETTINGS_FIELDS} } }`)
  return data.settings
}

export async function saveUpdateSettings(patch: Partial<UpdateSettings>): Promise<UpdateSettings> {
  const data = await gql<{ setSettings: { settings: UpdateSettings } }>(
    `mutation SetSettings($input: SetSettingsInput!) {
      setSettings(input: $input) { settings { ${SETTINGS_FIELDS} } }
    }`,
    { input: { settings: patch } },
  )
  return data.setSettings.settings
}

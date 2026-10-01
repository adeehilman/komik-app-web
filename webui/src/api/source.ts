import { gql } from './client'

export interface SourceItem {
  id: string
  name: string
  displayName: string
  lang: string
  iconUrl: string
  supportsLatest: boolean
  isNsfw: boolean
}

export interface SourceMangaItem {
  id: number
  title: string
  thumbnailUrl: string | null
  inLibrary: boolean
}

export type BrowseType = 'POPULAR' | 'LATEST' | 'SEARCH'

export async function fetchSources(): Promise<SourceItem[]> {
  const data = await gql<{ sources: { nodes: SourceItem[] } }>(`
    query Sources {
      sources { nodes { id name displayName lang iconUrl supportsLatest isNsfw } }
    }
  `)
  return data.sources.nodes
}

export async function fetchSource(id: string): Promise<SourceItem> {
  const data = await gql<{ source: SourceItem }>(
    `query Source($id: LongString!) {
      source(id: $id) { id name displayName lang iconUrl supportsLatest isNsfw }
    }`,
    { id },
  )
  return data.source
}

export async function fetchSourceManga(
  sourceId: string,
  type: BrowseType,
  page: number,
  query?: string,
): Promise<{ mangas: SourceMangaItem[]; hasNextPage: boolean }> {
  const data = await gql<{ fetchSourceManga: { mangas: SourceMangaItem[]; hasNextPage: boolean } }>(
    `mutation FetchSourceManga($input: FetchSourceMangaInput!) {
      fetchSourceManga(input: $input) {
        mangas { id title thumbnailUrl inLibrary }
        hasNextPage
      }
    }`,
    { input: { source: sourceId, type, page, query: type === 'SEARCH' ? query : null } },
  )
  return data.fetchSourceManga
}

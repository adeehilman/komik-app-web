import { gql } from './client'

export interface MangaDetail {
  id: number
  title: string
  author: string | null
  artist: string | null
  description: string | null
  genre: string[]
  status: string
  thumbnailUrl: string | null
  inLibrary: boolean
  initialized: boolean
  realUrl: string | null
  source: { id: string; displayName: string } | null
}

export async function fetchMangaDetail(id: number): Promise<MangaDetail> {
  const data = await gql<{ manga: MangaDetail }>(
    `query MangaDetail($id: Int!) {
      manga(id: $id) {
        id title author artist description genre status thumbnailUrl inLibrary initialized realUrl
        source { id displayName }
      }
    }`,
    { id },
  )
  return data.manga
}

/** Ambil ulang info manga (deskripsi, cover, status) dari source. */
export async function refreshMangaDetail(id: number): Promise<void> {
  await gql(
    `mutation FetchManga($input: FetchMangaInput!) { fetchManga(input: $input) { manga { id } } }`,
    { input: { id } },
  )
}

export async function setMangaInLibrary(id: number, inLibrary: boolean): Promise<void> {
  await gql(
    `mutation UpdateManga($input: UpdateMangaInput!) { updateManga(input: $input) { clientMutationId } }`,
    { input: { id, patch: { inLibrary } } },
  )
}

const STATUS_LABEL: Record<string, string> = {
  ONGOING: 'Ongoing',
  COMPLETED: 'Completed',
  LICENSED: 'Licensed',
  PUBLISHING_FINISHED: 'Publishing finished',
  CANCELLED: 'Cancelled',
  ON_HIATUS: 'On hiatus',
  UNKNOWN: 'Unknown',
}

export function statusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status
}

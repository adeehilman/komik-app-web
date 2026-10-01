import { gql } from './client'

export interface ChapterItem {
  id: number
  mangaId: number
  name: string
  chapterNumber: number
  sourceOrder: number
  scanlator: string | null
  uploadDate: string
  fetchedAt: string
  lastReadAt: string
  isRead: boolean
  isBookmarked: boolean
  isDownloaded: boolean
  lastPageRead: number
  pageCount: number
}

export const CHAPTER_FIELDS = `
  id mangaId name chapterNumber sourceOrder scanlator uploadDate fetchedAt lastReadAt
  isRead isBookmarked isDownloaded lastPageRead pageCount
`

/** Semua chapter satu manga, urut sourceOrder naik (1 = chapter paling lama). */
export async function fetchMangaChapters(mangaId: number): Promise<ChapterItem[]> {
  const data = await gql<{ chapters: { nodes: ChapterItem[] } }>(
    `query MangaChapters($mangaId: Int!) {
      chapters(condition: { mangaId: $mangaId }, order: [{ by: SOURCE_ORDER, byType: ASC }]) {
        nodes { ${CHAPTER_FIELDS} }
      }
    }`,
    { mangaId },
  )
  return data.chapters.nodes
}

/** Ambil ulang daftar chapter dari source (dipakai saat manga belum punya chapter / refresh). */
export async function refreshMangaChapters(mangaId: number): Promise<void> {
  await gql(
    `mutation FetchChapters($input: FetchChaptersInput!) {
      fetchChapters(input: $input) { chapters { id } }
    }`,
    { input: { mangaId } },
  )
}

export interface ChapterPatch {
  isRead?: boolean
  isBookmarked?: boolean
  lastPageRead?: number
}

export async function updateChapters(ids: number[], patch: ChapterPatch): Promise<void> {
  if (ids.length === 0) return
  await gql(
    `mutation UpdateChapters($input: UpdateChaptersInput!) {
      updateChapters(input: $input) { clientMutationId }
    }`,
    { input: { ids, patch } },
  )
}

export async function enqueueDownloads(ids: number[]): Promise<void> {
  if (ids.length === 0) return
  await gql(
    `mutation EnqueueDownloads($input: EnqueueChapterDownloadsInput!) {
      enqueueChapterDownloads(input: $input) { clientMutationId }
    }`,
    { input: { ids } },
  )
}

export async function deleteDownloads(ids: number[]): Promise<void> {
  if (ids.length === 0) return
  await gql(
    `mutation DeleteDownloads($input: DeleteDownloadedChaptersInput!) {
      deleteDownloadedChapters(input: $input) { clientMutationId }
    }`,
    { input: { ids } },
  )
}

/** id chapter milik beberapa manga sekaligus, opsional hanya yang belum dibaca / belum diunduh. */
export async function fetchChapterIdsForMangas(
  mangaIds: number[],
  opts: { unreadOnly?: boolean; notDownloadedOnly?: boolean } = {},
): Promise<number[]> {
  const filter: Record<string, unknown> = { mangaId: { in: mangaIds } }
  if (opts.unreadOnly) filter.isRead = { equalTo: false }
  if (opts.notDownloadedOnly) filter.isDownloaded = { equalTo: false }
  const data = await gql<{ chapters: { nodes: Array<{ id: number }> } }>(
    `query ChapterIds($filter: ChapterFilterInput!) { chapters(filter: $filter) { nodes { id } } }`,
    { filter },
  )
  return data.chapters.nodes.map((c) => c.id)
}

export interface ReaderChapter extends ChapterItem {
  manga: { id: number; title: string }
}

export async function fetchReaderChapter(chapterId: number): Promise<ReaderChapter> {
  const data = await gql<{ chapter: ReaderChapter }>(
    `query ReaderChapter($id: Int!) {
      chapter(id: $id) { ${CHAPTER_FIELDS} manga { id title } }
    }`,
    { id: chapterId },
  )
  return data.chapter
}

/** URL halaman relatif, mis. `/api/v1/manga/8/chapter/1/page/0` (terverifikasi ke server). */
export async function fetchChapterPages(chapterId: number): Promise<string[]> {
  const data = await gql<{ fetchChapterPages: { pages: string[] } }>(
    `mutation ChapterPages($input: FetchChapterPagesInput!) {
      fetchChapterPages(input: $input) { pages }
    }`,
    { input: { chapterId } },
  )
  return data.fetchChapterPages.pages
}

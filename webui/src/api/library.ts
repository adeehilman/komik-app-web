import { gql } from './client'

export interface MangaItem {
  id: number
  title: string
  thumbnailUrl: string | null
  inLibrary: boolean
  inLibraryAt: string
  status: string
  unreadCount: number
  downloadCount: number
  bookmarkCount: number
  chapters: { totalCount: number }
  firstUnreadChapter: { id: number } | null
  latestReadChapter: { id: number; lastReadAt: string } | null
  latestFetchedChapter: { fetchedAt: string } | null
  latestUploadedChapter: { uploadDate: string } | null
  categories: { nodes: Array<{ id: number }> }
  source: { id: string; displayName: string; lang: string } | null
}

export interface CategoryItem {
  id: number
  name: string
  order: number
  isDefaultCategory: boolean
}

export async function fetchLibrary(): Promise<{ mangas: MangaItem[]; categories: CategoryItem[] }> {
  const data = await gql<{ mangas: { nodes: MangaItem[] }; categories: { nodes: CategoryItem[] } }>(`
    query Library {
      mangas(condition: { inLibrary: true }) {
        nodes {
          id title thumbnailUrl inLibrary inLibraryAt status
          unreadCount downloadCount bookmarkCount
          chapters { totalCount }
          firstUnreadChapter { id }
          latestReadChapter { id lastReadAt }
          latestFetchedChapter { fetchedAt }
          latestUploadedChapter { uploadDate }
          categories { nodes { id } }
          source { id displayName lang }
        }
      }
      categories(order: [{ by: ORDER }]) { nodes { id name order isDefaultCategory } }
    }
  `)
  return { mangas: data.mangas.nodes, categories: data.categories.nodes }
}

export async function setMangasInLibrary(ids: number[], inLibrary: boolean): Promise<void> {
  await gql(
    `mutation UpdateMangas($input: UpdateMangasInput!) {
      updateMangas(input: $input) { clientMutationId }
    }`,
    { input: { ids, patch: { inLibrary } } },
  )
}

/** Set kategori (bukan tambah): kategori 0 = Default = tanpa kategori. */
export async function setMangasCategory(ids: number[], categoryId: number): Promise<void> {
  const patch = categoryId === 0 ? { clearCategories: true } : { clearCategories: true, addToCategories: [categoryId] }
  await gql(
    `mutation UpdateMangasCategories($input: UpdateMangasCategoriesInput!) {
      updateMangasCategories(input: $input) { clientMutationId }
    }`,
    { input: { ids, patch } },
  )
}

/** Thumbnail dari server berupa path relatif `/api/v1/manga/<id>/thumbnail`. */
export function coverUrl(thumbnailUrl: string | null | undefined): string | undefined {
  return thumbnailUrl || undefined
}

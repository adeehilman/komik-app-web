import { gql } from './client'
import { CHAPTER_FIELDS } from './chapter'
import type { ChapterItem } from './chapter'

export interface HistoryEntry extends ChapterItem {
  manga: { id: number; title: string; thumbnailUrl: string | null }
}

/**
 * Riwayat baca: chapter dengan lastReadAt > 0, terbaru dulu.
 * Seperti Mihon, satu baris per manga (chapter yang terakhir dibaca) — duplikat dibuang di klien.
 */
export async function fetchHistory(limit = 300): Promise<HistoryEntry[]> {
  const data = await gql<{ chapters: { nodes: HistoryEntry[] } }>(
    `query History($first: Int!) {
      chapters(
        filter: { lastReadAt: { greaterThan: "0" } }
        order: [{ by: LAST_READ_AT, byType: DESC }]
        first: $first
      ) {
        nodes { ${CHAPTER_FIELDS} manga { id title thumbnailUrl } }
      }
    }`,
    { first: limit },
  )
  const seen = new Set<number>()
  return data.chapters.nodes.filter((c) => {
    if (seen.has(c.mangaId)) return false
    seen.add(c.mangaId)
    return true
  })
}

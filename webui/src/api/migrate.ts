import { fetchMangaChapters, refreshMangaChapters, updateChapters } from './chapter'
import type { ChapterItem } from './chapter'
import { fetchMangaDetail, setMangaInLibrary } from './manga'
import { setMangasCategories } from './library'

/*
 * Migrasi antar-source ala Mihon (v2): pindah judul dari extension A ke
 * extension B tanpa duplikat.
 *
 * Alur: pilih source tujuan -> cari judul di source itu -> pilih entri yang
 * cocok -> salin kategori + status chapter (terbaca/bookmark/progres) dari
 * entri lama ke entri baru, dicocokkan per nomor chapter.
 *
 * Yang TIDAK ikut: unduhan (file tersimpan per id manga di server, tidak bisa
 * dipindah lewat API — unduh ulang di sumber baru). Entri lama TIDAK otomatis
 * dihapus dari library; halaman hasil menawarkan "Sembunyikan sumber lama"
 * supaya judul tidak ganda di Library (progres lama tetap tersimpan).
 *
 * Semua operasi GraphQL di sini sudah dipakai WebUI (chapter.ts, library.ts,
 * manga.ts, source.ts) — tidak ada field baru yang ditebak.
 */

export interface ChapterMatch {
  source: ChapterItem
  target: ChapterItem | null
}

/**
 * Cocokkan chapter sumber ke chapter tujuan per nomor chapter. Bila ada
 * beberapa chapter tujuan dengan nomor sama, utamakan scanlator yang sama,
 * lalu sourceOrder terkecil.
 */
export function matchChapters(source: ChapterItem[], target: ChapterItem[]): ChapterMatch[] {
  const byNumber = new Map<number, ChapterItem[]>()
  for (const t of target) {
    const list = byNumber.get(t.chapterNumber)
    if (list) list.push(t)
    else byNumber.set(t.chapterNumber, [t])
  }
  return source.map((s) => {
    const cands = byNumber.get(s.chapterNumber) ?? []
    const sameScanlator = cands.find((t) => (t.scanlator ?? '') === (s.scanlator ?? ''))
    return { source: s, target: sameScanlator ?? cands[0] ?? null }
  })
}

export interface MigrationSummary {
  targetId: number
  targetTitle: string
  targetInLibraryBefore: boolean
  sourceChapterCount: number
  targetChapterCount: number
  readCopied: number
  bookmarkCopied: number
  progressCopied: boolean
  progressChapterName: string | null
  categoryIds: number[]
  unmatched: ChapterItem[]
}

export async function runMigration(opts: {
  sourceId: number
  targetId: number
  includeChapters: boolean
  includeCategories: boolean
  onProgress?: (msg: string) => void
}): Promise<MigrationSummary> {
  const { sourceId, targetId, includeChapters, includeCategories, onProgress } = opts
  const say = (msg: string) => onProgress?.(msg)

  say('Mengambil data judul lama…')
  const [source, sourceChapters] = await Promise.all([
    fetchMangaDetail(sourceId),
    fetchMangaChapters(sourceId),
  ])

  say('Mengambil daftar chapter tujuan…')
  let targetChapters = await fetchMangaChapters(targetId)
  if (targetChapters.length === 0) {
    say('Tujuan belum punya chapter, mengambil dari source…')
    await refreshMangaChapters(targetId)
    targetChapters = await fetchMangaChapters(targetId)
  }
  const targetDetail = await fetchMangaDetail(targetId)

  if (!targetDetail.inLibrary) {
    say('Menambahkan judul baru ke library…')
    await setMangaInLibrary(targetId, true)
  }

  const categoryIds = source.categories.nodes.map((c) => c.id)
  if (includeCategories) {
    say('Menyalin kategori…')
    await setMangasCategories([targetId], categoryIds)
  }

  let readCopied = 0
  let bookmarkCopied = 0
  let progressCopied = false
  let progressChapterName: string | null = null
  const unmatched: ChapterItem[] = []

  if (includeChapters) {
    const matches = matchChapters(sourceChapters, targetChapters)
    const readIds: number[] = []
    const bookmarkIds: number[] = []
    for (const m of matches) {
      const hasState = m.source.isRead || m.source.isBookmarked || m.source.lastPageRead > 0
      if (!m.target) {
        if (hasState) unmatched.push(m.source)
        continue
      }
      if (m.source.isRead) {
        readIds.push(m.target.id)
        readCopied++
      }
      if (m.source.isBookmarked) {
        bookmarkIds.push(m.target.id)
        bookmarkCopied++
      }
    }
    if (readIds.length > 0) {
      say(`Menandai ${readIds.length} chapter sebagai dibaca…`)
      await updateChapters(readIds, { isRead: true })
    }
    if (bookmarkIds.length > 0) {
      say(`Menyalin ${bookmarkIds.length} bookmark…`)
      await updateChapters(bookmarkIds, { isBookmarked: true })
    }
    // Progres "lanjut baca": chapter terakhir dibaca yang punya lastPageRead.
    const inProgress = [...sourceChapters]
      .filter((c) => c.lastPageRead > 0)
      .sort((a, b) => Number(b.lastReadAt) - Number(a.lastReadAt))[0]
    if (inProgress) {
      const match = matches.find((m) => m.source.id === inProgress.id)
      if (match?.target) {
        say('Menyalin posisi baca terakhir…')
        await updateChapters([match.target.id], { lastPageRead: inProgress.lastPageRead })
        progressCopied = true
        progressChapterName = inProgress.name
      }
    }
  }

  return {
    targetId,
    targetTitle: targetDetail.title,
    targetInLibraryBefore: targetDetail.inLibrary,
    sourceChapterCount: sourceChapters.length,
    targetChapterCount: targetChapters.length,
    readCopied,
    bookmarkCopied,
    progressCopied,
    progressChapterName,
    categoryIds,
    unmatched,
  }
}

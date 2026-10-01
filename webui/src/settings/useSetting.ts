import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { gql } from '../api/client'
import type { SettingKey, SettingsSchema } from './schema'
import { META_PREFIX, parseSettingValue, serializeSettingValue } from './schema'

/*
 * Sumber kebenaran = global meta di server (.agents/nodes/settings.md).
 * Semua key `mihonweb_*` diambil dengan SATU query dan dibagi lewat cache TanStack,
 * jadi setiap komponen yang memakai key yang sama otomatis sinkron.
 * localStorage hanya cache baca-cepat supaya UI langsung tampil sebelum server menjawab.
 */

type MetaMap = Record<string, string>

const GLOBAL_KEY = ['globalMeta'] as const
const CACHE_KEY = 'mihonweb_meta_cache'

function readCache(): MetaMap | undefined {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? (JSON.parse(raw) as MetaMap) : undefined
  } catch {
    return undefined
  }
}

function writeCache(map: MetaMap) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(map))
  } catch {
    // storage penuh / private mode: abaikan, server tetap sumber kebenaran
  }
}

async function fetchGlobalMeta(): Promise<MetaMap> {
  const data = await gql<{ metas: { nodes: Array<{ key: string; value: string }> } }>(
    `query GlobalMeta($prefix: String!) {
      metas(filter: { key: { startsWith: $prefix } }) { nodes { key value } }
    }`,
    { prefix: META_PREFIX },
  )
  const map: MetaMap = {}
  for (const node of data.metas.nodes) map[node.key] = node.value
  writeCache(map)
  return map
}

async function saveGlobalMeta(key: string, value: string) {
  await gql(
    `mutation SetGlobalMeta($input: SetGlobalMetaInput!) {
      setGlobalMeta(input: $input) { meta { key value } }
    }`,
    { input: { meta: { key, value } } },
  )
}

export function useGlobalMeta() {
  return useQuery({
    queryKey: GLOBAL_KEY,
    queryFn: fetchGlobalMeta,
    placeholderData: readCache,
    staleTime: 5 * 60 * 1000,
  })
}

export function useSetting<K extends SettingKey>(
  key: K,
): [SettingsSchema[K], (value: SettingsSchema[K]) => Promise<void>] {
  const queryClient = useQueryClient()
  const { data } = useGlobalMeta()
  const value = parseSettingValue(key, data?.[key])

  const setValue = useCallback(
    async (next: SettingsSchema[K]) => {
      const raw = serializeSettingValue(next)
      const previous = queryClient.getQueryData<MetaMap>(GLOBAL_KEY)
      // Optimistis: UI berubah dulu, lalu ditulis ke server. Gagal → kembalikan.
      const optimistic = { ...(previous ?? readCache() ?? {}), [key]: raw }
      queryClient.setQueryData(GLOBAL_KEY, optimistic)
      writeCache(optimistic)
      try {
        await saveGlobalMeta(key, raw)
      } catch (error) {
        if (previous) {
          queryClient.setQueryData(GLOBAL_KEY, previous)
          writeCache(previous)
        }
        throw error
      }
    },
    [key, queryClient],
  )

  return [value, setValue]
}

/*
 * Setelan per manga (manga meta). Kosong = ikut setelan global, seperti Mihon yang
 * bisa mengatur mode baca per judul.
 */
export interface MangaSetting<K extends SettingKey> {
  value: SettingsSchema[K]
  isOverride: boolean
  setGlobal: (value: SettingsSchema[K]) => Promise<void>
  setForManga: (value: SettingsSchema[K]) => Promise<void>
  clearOverride: () => Promise<void>
}

export function useMangaSetting<K extends SettingKey>(mangaId: number | undefined, key: K): MangaSetting<K> {
  const queryClient = useQueryClient()
  const [globalValue, setGlobal] = useSetting(key)
  const { data } = useQuery({
    queryKey: ['mangaMeta', mangaId],
    enabled: mangaId !== undefined,
    queryFn: async () => {
      const res = await gql<{ manga: { meta: Array<{ key: string; value: string }> } }>(
        `query MangaMeta($id: Int!) { manga(id: $id) { meta { key value } } }`,
        { id: mangaId },
      )
      const map: MetaMap = {}
      for (const m of res.manga.meta) map[m.key] = m.value
      return map
    },
    staleTime: 5 * 60 * 1000,
  })

  const raw = data?.[key]
  const isOverride = raw !== undefined && raw !== ''

  const setForManga = useCallback(
    async (next: SettingsSchema[K]) => {
      if (mangaId === undefined) return setGlobal(next)
      const value = serializeSettingValue(next)
      queryClient.setQueryData<MetaMap>(['mangaMeta', mangaId], (old) => ({ ...(old ?? {}), [key]: value }))
      await gql(
        `mutation SetMangaMeta($input: SetMangaMetaInput!) {
          setMangaMeta(input: $input) { meta { key value } }
        }`,
        { input: { meta: { mangaId, key, value } } },
      )
    },
    [mangaId, key, queryClient, setGlobal],
  )

  const clearOverride = useCallback(async () => {
    if (mangaId === undefined) return
    queryClient.setQueryData<MetaMap>(['mangaMeta', mangaId], (old) => {
      const copy = { ...(old ?? {}) }
      delete copy[key]
      return copy
    })
    await gql(
      `mutation DeleteMangaMeta($input: DeleteMangaMetaInput!) {
        deleteMangaMeta(input: $input) { clientMutationId }
      }`,
      { input: { mangaId, key } },
    )
  }, [mangaId, key, queryClient])

  return {
    value: isOverride ? parseSettingValue(key, raw) : globalValue,
    isOverride,
    setGlobal,
    setForManga,
    clearOverride,
  }
}

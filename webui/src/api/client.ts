const ENDPOINT = '/api/graphql'

interface GqlResponse<T> {
  data?: T
  errors?: Array<{ message: string }>
}

async function unwrap<T>(res: Response): Promise<T> {
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`)
  }
  const json = (await res.json()) as GqlResponse<T>
  if (json.errors && json.errors.length > 0) {
    throw new Error(json.errors[0]?.message || 'GraphQL error')
  }
  return json.data as T
}

export async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  return unwrap<T>(res)
}

/**
 * GraphQL multipart request (operations + map + file), dipakai untuk `Upload`.
 * Format terverifikasi ke server kita dengan `validateBackup` (lihat .agents/nodes/graphql.md).
 */
export async function gqlUpload<T>(
  query: string,
  variables: Record<string, unknown>,
  fileVariable: string,
  file: File,
): Promise<T> {
  const form = new FormData()
  form.append('operations', JSON.stringify({ query, variables: { ...variables, [fileVariable]: null } }))
  form.append('map', JSON.stringify({ '0': [`variables.${fileVariable}`] }))
  form.append('0', file, file.name)
  const res = await fetch(ENDPOINT, { method: 'POST', body: form })
  return unwrap<T>(res)
}

/** LongString dari server dikirim sebagai string; ubah ke number (0 kalau kosong). */
export function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

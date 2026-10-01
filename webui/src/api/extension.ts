import { gql } from './client'

export interface ExtensionItem {
  pkgName: string
  name: string
  lang: string
  versionName: string
  iconUrl: string
  isInstalled: boolean
  hasUpdate: boolean
  isObsolete: boolean
  isNsfw: boolean
}

const FIELDS = 'pkgName name lang versionName iconUrl isInstalled hasUpdate isObsolete isNsfw'

export async function fetchExtensions(): Promise<ExtensionItem[]> {
  const data = await gql<{ extensions: { nodes: ExtensionItem[] } }>(
    `query Extensions { extensions { nodes { ${FIELDS} } } }`,
  )
  return data.extensions.nodes
}

/** Ambil ulang daftar dari extension store (keiyoushi). */
export async function refreshExtensionStore(): Promise<void> {
  await gql(
    `mutation FetchExtensions($input: FetchExtensionsInput!) {
      fetchExtensions(input: $input) { extensions { pkgName } }
    }`,
    { input: {} },
  )
}

export type ExtensionAction = 'install' | 'update' | 'uninstall'

export async function changeExtension(pkgName: string, action: ExtensionAction): Promise<void> {
  await gql(
    `mutation UpdateExtension($input: UpdateExtensionInput!) {
      updateExtension(input: $input) { clientMutationId }
    }`,
    { input: { id: pkgName, patch: { [action]: true } } },
  )
}

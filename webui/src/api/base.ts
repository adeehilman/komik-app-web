// Base path where the app is mounted, e.g. "/komik" when served behind a
// subpath (Tailscale Funnel). Set via VITE_APP_BASE at build time.
// Defaults to "" (served at root).
export const APP_BASE: string =
  (import.meta.env.VITE_APP_BASE as string | undefined) || ''

/**
 * Prefix a server-absolute path ("/api/...") with the mount base so it
 * resolves correctly when the app is served under a subpath.
 * Non-absolute values (already absolute URLs, relative paths) pass through.
 */
export function serverPath(p: string): string {
  if (!p || !p.startsWith('/')) return p
  if (!APP_BASE) return p
  if (p.startsWith(APP_BASE + '/') || p === APP_BASE) return p
  return APP_BASE + p
}

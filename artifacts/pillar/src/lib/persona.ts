// Demo-mode viewer switching: the View-as menu and `?as=<persona>` deep links share this path
// so company and page redirects behave the same either way.

import { useStore } from './store'
import { PERSONA_PARAM, pathAfterSwitch, resolvePersona } from './navigation'

/** Switch the viewer in the store. Returns the path to navigate to when the current page is not theirs, else null. */
export function switchViewer(userId: string, pathname: string): string | null {
  const before = useStore.getState().companyId
  useStore.getState().setUser(userId)
  const { db, companyId } = useStore.getState()
  return pathAfterSwitch(db, userId, pathname, before, companyId)
}

/**
 * Apply `?as=` from the address bar before the app mounts, then remove it so later navigation
 * behaves normally. Unknown personas are ignored (the parameter is still removed).
 */
export function applyPersonaFromUrl(basename = '/') {
  const url = new URL(window.location.href)
  if (!url.searchParams.has(PERSONA_PARAM)) return
  const value = url.searchParams.get(PERSONA_PARAM)
  url.searchParams.delete(PERSONA_PARAM)

  const base = basename.replace(/\/$/, '')
  const appPath = base && url.pathname.startsWith(base) ? url.pathname.slice(base.length) || '/' : url.pathname
  const userId = resolvePersona(useStore.getState().db, value)
  if (userId) {
    // Mirror the route gate: the company in the URL is the one being viewed.
    const urlCompany = appPath.match(/^\/c\/([^/]+)/)?.[1]
    if (urlCompany) useStore.getState().setCompany(urlCompany)
    const next = switchViewer(userId, appPath)
    if (next) url.pathname = `${base}${next}`
  }
  window.history.replaceState(window.history.state, '', url)
}

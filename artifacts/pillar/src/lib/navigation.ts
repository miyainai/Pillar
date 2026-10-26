import type { DB, Role } from './types'
import { roleOf } from './permissions'

/** Keep the active top-level tab, never a different company's item identifiers. */
export function companyTabPath(pathname: string, companyId: string, role: Role | null) {
  const tab = pathname.match(/^\/c\/[^/]+\/([^/]+)/)?.[1]
  const section = tab === 'pillars' ? 'plan' : tab
  const supported = ['plan', 'asks', 'files', 'progress', 'settings']
  const restricted = role === 'Management' && (section === 'progress' || section === 'settings')
  return `/c/${companyId}${section && supported.includes(section) && !restricted ? `/${section}` : ''}`
}

/**
 * Where to go after the viewer changes, or null to stay put. Mirrors the View-as menu:
 * stay on the same page when the new viewer can see it, otherwise their dashboard.
 */
export function pathAfterSwitch(db: DB, userId: string, pathname: string, fromCompanyId: string, toCompanyId: string): string | null {
  if (!pathname.startsWith('/c/')) return null
  const role = roleOf(db, userId, toCompanyId)
  const firmOnlyPage = /\/(progress|settings)/.test(pathname)
  if (toCompanyId !== fromCompanyId || (role === 'Management' && firmOnlyPage)) return companyTabPath(pathname, toCompanyId, role)
  return null
}

// ---------------- Persona deep links (demo) ----------------

export const PERSONA_PARAM = 'as'

const slugify = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** Resolve `?as=` to a user id: exact id, first name, or full name (case-insensitive). Unknown values give null. */
export function resolvePersona(db: DB, value: string | null | undefined): string | null {
  if (!value) return null
  const v = slugify(value)
  if (!v) return null
  const byId = db.users.find((u) => u.id.toLowerCase() === v || slugify(u.id) === v)
  if (byId) return byId.id
  const byFirst = db.users.filter((u) => slugify(u.name.split(' ')[0]) === v)
  if (byFirst.length === 1) return byFirst[0].id
  const byFull = db.users.find((u) => slugify(u.name) === v)
  return byFull?.id ?? null
}

/** Shortest value that resolves back to this user: first name when unambiguous, else the id. */
export function personaSlug(db: DB, userId: string): string {
  const u = db.users.find((x) => x.id === userId)
  if (!u) return userId
  const first = slugify(u.name.split(' ')[0])
  return resolvePersona(db, first) === userId ? first : u.id
}

/** The given URL with the persona parameter set for this user. */
export function demoLink(href: string, db: DB, userId: string): string {
  const url = new URL(href)
  url.searchParams.set(PERSONA_PARAM, personaSlug(db, userId))
  return url.toString()
}

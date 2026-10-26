// Upgrading saved demo data between seed versions.
//
// Anything someone built in the browser (their own companies, plan edits, updates,
// files) must survive a new release. The saved database is kept; fields added or
// renamed since OLDEST_UPGRADABLE are filled in or converted below. "Reset demo"
// is the way to pick up changed sample content.

import type { DB, WorkstreamRef } from './types'
import { DEFAULT_SETTINGS, SEED_VERSION, buildSeed } from './seed'

/**
 * Remove or rewrite the workstream refs that point at plan items that no longer exist, so saved data
 * does not keep "Move to folder" tags and document workstreams for deleted pillars/sub-pillars. Tags
 * matching `dead` are dropped (the file falls back to its origin); document workstreams are replaced
 * with `fallback(ref)`, or cleared when it returns null. Used both when a plan item is hard-deleted
 * and on load, for plans saved before deletion started cleaning up after itself.
 */
export function dropWorkstreamRefs(db: DB, dead: (ref: WorkstreamRef) => boolean, fallback: (ref: WorkstreamRef) => WorkstreamRef | null) {
  if (db.fileTags) {
    for (const [fileId, tag] of Object.entries(db.fileTags)) if (dead(tag)) delete db.fileTags[fileId]
  }
  for (const doc of db.documents) {
    if (!doc.workstream || !dead(doc.workstream)) continue
    doc.workstream = fallback(doc.workstream) ?? undefined
  }
}

/**
 * Drop refs to pillars/sub-pillars that are not in the saved plan, mirroring deletePillar and
 * deleteSubPillar. Retired pillars still exist as records, so refs to them are kept. A ref whose
 * sub-pillar is missing but whose pillar remains is reduced to the pillar (documents) or dropped (tags).
 * Runs on every load (not only on a version change), since plans saved at the current seed version
 * may predate the deletion clean-up. Returns the same object.
 */
export function dropDanglingWorkstreamRefs(db: DB): DB {
  const pillars = new Set(db.pillars.map((p) => p.id))
  const subs = new Set(db.subPillars.filter((s) => pillars.has(s.pillarId)).map((s) => s.id))
  dropWorkstreamRefs(db, (ref) => !pillars.has(ref.pillarId), () => null)
  dropWorkstreamRefs(db, (ref) => !!ref.subPillarId && !subs.has(ref.subPillarId), (ref) => ({ pillarId: ref.pillarId, subPillarId: null }))
  return db
}

/** Saved data at or after this seed version is kept on upgrade; anything older is replaced. */
export const OLDEST_UPGRADABLE = 4

export function canUpgrade(version: number | undefined, db: unknown): db is DB {
  return typeof version === 'number' && version >= OLDEST_UPGRADABLE && !!db && typeof db === 'object' && Array.isArray((db as DB).companies)
}

/** Fill in fields added since the saved version. Returns the same object, upgraded. */
export function upgradeDb(db: DB): DB {
  const seed = buildSeed()
  db.fileTags ??= {}
  db.visits ??= {}
  db.commentary ??= []
  db.settings ??= {}
  for (const c of db.companies) {
    db.settings[c.id] ??= structuredClone(DEFAULT_SETTINGS)
    // Demo companies gained logo marks; keep anything the user already set.
    const s = seed.companies.find((x) => x.id === c.id)
    if (s?.logoUrl && !c.logoUrl) c.logoUrl = s.logoUrl
  }
  for (const u of db.users) {
    const s = seed.users.find((x) => x.id === u.id)
    if (s?.avatarUrl && !u.avatarUrl) u.avatarUrl = s.avatarUrl
  }
  for (const d of db.documents) if (d.workstream === null) delete d.workstream
  // Deleting a pillar did not always clean up the folder tags and workstreams that pointed at it.
  dropDanglingWorkstreamRefs(db)
  // Asks went from one owner (assigneeId) to several (assigneeIds).
  for (const a of db.asks as (DB['asks'][number] & { assigneeId?: string })[]) {
    if (!Array.isArray(a.assigneeIds)) a.assigneeIds = a.assigneeId ? [a.assigneeId] : []
    delete a.assigneeId
  }
  db.seedVersion = SEED_VERSION
  return db
}

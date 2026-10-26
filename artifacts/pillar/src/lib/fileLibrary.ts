// The file library (metadata index; attachment bytes live in files.ts): one list of every file the deal has touched, built from the
// permission-scoped View so management only ever sees what it would see elsewhere.
//
// Three sources feed it: deal materials (setup / Files tab), attachments on
// progress updates, and the raw / context / final files on data requests.

import type { PillarView, SubPillarView, View } from './permissions'
import type { Ask, Attachment, DocType, Document, Phase, Update, WorkstreamRef } from './types'
import { fmtDateYear } from './dates'
import { userName } from './selectors'

export const DOC_TYPES: DocType[] = ['IC deck', 'Model', 'CIM', 'QoE', 'Diligence report', 'Other']

export type FileSource = 'setup' | 'update' | 'ask'
export const SOURCE_LABEL: Record<FileSource, string> = { setup: 'Setup', update: 'Update', ask: 'Data request' }

export type AskStage = NonNullable<Attachment['stage']>
export const STAGE_LABEL: Record<AskStage, string> = { raw: 'Management upload', context: 'Shared context', final: 'Deal team final' }
const STAGE_ORDER: AskStage[] = ['raw', 'context', 'final']

export interface Workstream {
  pillar: PillarView
  sub: SubPillarView | null
  phase: Phase | null
}

export interface TrailStep {
  label: string
  /** Where clicking this step goes; omitted for steps that are only labels. */
  to?: string
}

export type FileOrigin =
  | { kind: 'document'; document: Document }
  | { kind: 'update'; update: Update }
  | { kind: 'ask'; ask: Ask; stage: AskStage | null }

export interface LibraryFile {
  /** The document or attachment id; stable across renders and reloads. */
  id: string
  name: string
  size: number
  uploadedBy: string
  date: string
  source: FileSource
  /** Document type, "Update attachment", or the data-request stage. */
  category: string
  /** Folder keys this file appears in (besides "all"). */
  folders: string[]
  workstream: Workstream | null
  /** True when the workstream comes from a "Move to folder" tag rather than the origin. */
  retagged: boolean
  origin: FileOrigin
  /** Text of the update or request it was attached to, or the note given when it was added. */
  note: string
  trail: TrailStep[]
}

export interface FolderNode {
  key: string
  label: string
  count: number
  children: FolderNode[]
}

// Folder keys. The tree and the per-file folder lists share these.
export const FOLDER = {
  all: 'all',
  materials: 'materials',
  docType: (t: DocType) => `materials:${t}`,
  workstreams: 'workstreams',
  pillar: (id: string) => `ws:${id}`,
  sub: (id: string) => `ws:${id}`,
  requests: 'requests',
  stage: (s: AskStage) => `requests:${s}`,
}

function resolveWorkstream(view: View, ref: WorkstreamRef | null | undefined, phaseId?: string | null): Workstream | null {
  if (!ref) return null
  const pillar = view.pillars.find((p) => p.id === ref.pillarId)
  if (!pillar) return null
  const sub = ref.subPillarId ? view.subPillars.find((s) => s.id === ref.subPillarId && s.pillarId === pillar.id) ?? null : null
  const phase = phaseId ? view.phases.find((ph) => ph.id === phaseId && ph.pillarId === pillar.id && (ph.subPillarId ?? null) === (sub?.id ?? null)) ?? null : null
  return { pillar, sub, phase }
}

function workstreamFolders(ws: Workstream | null): string[] {
  if (!ws) return []
  return [FOLDER.workstreams, FOLDER.pillar(ws.pillar.id), ...(ws.sub ? [FOLDER.sub(ws.sub.id)] : [])]
}

/**
 * Deep link to one update in its pillar's feed; the pillar page scrolls to and highlights `#<updateId>`.
 * Always points at the pillar the update was posted on, even when an attachment has been filed elsewhere.
 * Undefined when the update is not in the viewer's feed (its pillar or sub-pillar was retired or
 * removed), since there is no page that would show it.
 */
export function updateLink(view: View, u: Update): string | undefined {
  if (!view.updates.some((x) => x.id === u.id)) return undefined
  return `/c/${view.company.id}/pillars/${u.pillarId}#${encodeURIComponent(u.id)}`
}

function workstreamTrail(view: View, ws: Workstream): TrailStep[] {
  const base = `/c/${view.company.id}`
  return [
    { label: `${ws.pillar.num}. ${ws.pillar.name}`, to: `${base}/pillars/${ws.pillar.id}` },
    ...(ws.sub ? [{ label: `${ws.sub.num} ${ws.sub.name}`, to: `${base}/pillars/${ws.pillar.id}` }] : []),
    ...(ws.phase ? [{ label: ws.phase.name }] : []),
  ]
}

/** Every file visible in `view`, newest first. */
export function libraryFiles(view: View): LibraryFile[] {
  const base = `/c/${view.company.id}`
  const company: TrailStep = { label: view.company.name, to: base }
  const tags = view.fileTags ?? {}
  const out: LibraryFile[] = []

  for (const d of view.documents) {
    const ws = resolveWorkstream(view, d.workstream)
    out.push({
      id: d.id,
      name: d.name,
      size: d.size,
      uploadedBy: d.uploadedBy,
      date: d.date,
      source: 'setup',
      category: d.type,
      folders: [FOLDER.materials, FOLDER.docType(d.type), ...workstreamFolders(ws)],
      workstream: ws,
      retagged: false,
      origin: { kind: 'document', document: d },
      note: d.note ?? '',
      trail: [company, { label: 'Deal materials', to: `${base}/files` }, { label: d.type }, ...(ws ? workstreamTrail(view, ws) : [])],
    })
  }

  // Attachments outlive the plan item they were posted on: an update on a retired or removed
  // workstream drops out of the Progress feed but its files stay listed here, with no workstream
  // (or the parent pillar's, when only the sub-pillar went) unless a tag has moved them elsewhere.
  for (const u of [...view.updates, ...view.retiredUpdates]) {
    for (const f of u.attachments) {
      const tag = tags[f.id]
      const ws = resolveWorkstream(view, tag ?? { pillarId: u.pillarId, subPillarId: u.subPillarId }, tag ? null : u.phaseId)
      out.push({
        id: f.id,
        name: f.name,
        size: f.size,
        uploadedBy: f.uploadedBy,
        date: f.at,
        source: 'update',
        category: 'Update attachment',
        folders: workstreamFolders(ws),
        workstream: ws,
        retagged: !!tag && !!ws,
        origin: { kind: 'update', update: u },
        note: u.text,
        trail: [
          company,
          ...(ws ? workstreamTrail(view, ws) : []),
          { label: `Update by ${userName(view, u.authorId)} on ${fmtDateYear(u.createdAt)}`, to: updateLink(view, u) },
        ],
      })
    }
  }

  for (const a of view.asks) {
    for (const f of a.attachments) {
      const tag = tags[f.id]
      const ref = tag ?? (a.pillarId ? { pillarId: a.pillarId, subPillarId: a.subPillarId } : null)
      const ws = resolveWorkstream(view, ref)
      const stage = f.stage ?? null
      out.push({
        id: f.id,
        name: f.name,
        size: f.size,
        uploadedBy: f.uploadedBy,
        date: f.at,
        source: 'ask',
        category: stage ? STAGE_LABEL[stage] : 'Data request file',
        folders: [FOLDER.requests, ...(stage ? [FOLDER.stage(stage)] : []), ...workstreamFolders(ws)],
        workstream: ws,
        retagged: !!tag && !!ws,
        origin: { kind: 'ask', ask: a, stage },
        note: a.description ?? a.context ?? '',
        trail: [
          company,
          ...(ws ? workstreamTrail(view, ws) : []),
          { label: `Data request "${a.title}"${stage ? ` (${STAGE_LABEL[stage].toLowerCase()})` : ''}`, to: `${base}/asks/${a.id}` },
        ],
      })
    }
  }

  return out.sort((x, y) => y.date.localeCompare(x.date) || x.name.localeCompare(y.name))
}

/** The left-hand tree. Counts include every file under the node. */
export function folderTree(view: View, files: LibraryFile[]): FolderNode[] {
  const count = (key: string) => (key === FOLDER.all ? files.length : files.filter((f) => f.folders.includes(key)).length)
  const node = (key: string, label: string, children: FolderNode[] = []): FolderNode => ({ key, label, count: count(key), children })
  const mgmt = view.viewer.isMgmt
  const tree: FolderNode[] = [node(FOLDER.all, 'All files')]
  if (!mgmt) tree.push(node(FOLDER.materials, 'Deal materials', DOC_TYPES.map((t) => node(FOLDER.docType(t), t))))
  tree.push(
    node(
      FOLDER.workstreams,
      'Workstreams',
      view.pillars.map((p) =>
        node(
          FOLDER.pillar(p.id),
          `${p.num}. ${p.name}`,
          view.subPillars.filter((s) => s.pillarId === p.id).map((s) => node(FOLDER.sub(s.id), `${s.num} ${s.name}`)),
        ),
      ),
    ),
    node(
      FOLDER.requests,
      'Data requests',
      STAGE_ORDER.filter((s) => !mgmt || s !== 'final').map((s) => node(FOLDER.stage(s), STAGE_LABEL[s])),
    ),
  )
  return tree
}

export function trailText(file: LibraryFile): string {
  return file.trail.map((t) => t.label).join(' › ')
}

/** Human label for a folder key, used in forms and the empty state. */
export function folderLabel(tree: FolderNode[], key: string): string {
  const walk = (nodes: FolderNode[]): string | undefined => {
    for (const n of nodes) {
      if (n.key === key) return n.label
      const inner = walk(n.children)
      if (inner) return inner
    }
    return undefined
  }
  return walk(tree) ?? 'All files'
}

/** Workstream choices for the Add files and Move to folder forms, in plan order. */
export function workstreamOptions(view: View): { value: string; label: string; ref: WorkstreamRef }[] {
  return view.pillars.flatMap((p) => [
    { value: p.id, label: `${p.num}. ${p.name}`, ref: { pillarId: p.id, subPillarId: null } },
    ...view.subPillars.filter((s) => s.pillarId === p.id).map((s) => ({ value: s.id, label: `   ${s.num} ${s.name}`, ref: { pillarId: p.id, subPillarId: s.id } })),
  ])
}

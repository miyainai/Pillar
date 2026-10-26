import { useMemo, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import clsx from 'clsx'
import { ChevronDown, ChevronRight, File, FolderInput, FolderOpen, Paperclip, Plus, Search, X } from 'lucide-react'
import { useStore } from '../lib/store'
import type { View } from '../lib/permissions'
import { fmtSize, useView, userName } from '../lib/selectors'
import { fmtDateYear, relTime } from '../lib/dates'
import type { DocType, WorkstreamRef } from '../lib/types'
import { DOC_TYPES, FOLDER, SOURCE_LABEL, folderLabel, folderTree, libraryFiles, trailText, updateLink, workstreamOptions, type FolderNode, type LibraryFile } from '../lib/fileLibrary'
import { filesWorkbook } from '../lib/exports'
import { Avatar, Button, Card, Empty, Field, FilePicker, Modal, PageHeader, Select, inputCls } from '../components/ui'
import { ExportButton } from '../components/ExportButton'

type Sort = 'date' | 'name'
type Picked = { name: string; size: number }

export default function Files() {
  const view = useView()
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<Sort>('date')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [moving, setMoving] = useState(false)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const files = useMemo(() => (view ? libraryFiles(view) : []), [view])
  const tree = useMemo(() => (view ? folderTree(view, files) : []), [view, files])
  if (!view) return null

  const folder = params.get('f') ?? FOLDER.all
  const setFolder = (key: string) => {
    setParams(key === FOLDER.all ? {} : { f: key }, { replace: true })
    setSelectedId(null)
  }
  const q = query.trim().toLowerCase()
  const shown = files
    .filter((f) => folder === FOLDER.all || f.folders.includes(folder))
    .filter((f) => !q || f.name.toLowerCase().includes(q) || trailText(f).toLowerCase().includes(q) || userName(view, f.uploadedBy).toLowerCase().includes(q))
    .sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name) : b.date.localeCompare(a.date) || a.name.localeCompare(b.name)))
  const selected = selectedId ? files.find((f) => f.id === selectedId) ?? null : null
  const label = folderLabel(tree, folder)
  const canManage = view.viewer.isFirm

  return (
    <div>
      <PageHeader
        title="Files"
        subtitle="Every file this deal has touched, filed by where it came from. Hover a row for its trail; click for the detail."
        actions={
          <>
            <ExportButton build={() => filesWorkbook(view, shown, label)} />
            {canManage && (
              <Button variant="primary" icon={<Plus className="size-3.5" />} onClick={() => setAdding(true)}>
                Add files
              </Button>
            )}
          </>
        }
      />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <Card className="shrink-0 lg:w-64" pad={false}>
          <nav aria-label="Folders" className="py-1.5">
            {tree.map((n) => (
              <TreeNode key={n.key} node={n} depth={0} active={folder} collapsed={collapsed} onToggle={(k) => setCollapsed((c) => ({ ...c, [k]: !c[k] }))} onSelect={setFolder} />
            ))}
          </nav>
        </Card>

        <div className="min-w-0 flex-1 space-y-4">
          <Card
            pad={false}
            title={
              <>
                {label}
                <span className="font-normal text-zinc-400">
                  {shown.length} file{shown.length === 1 ? '' : 's'}
                </span>
              </>
            }
            action={
              <>
                <label className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-zinc-400" />
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search files" aria-label="Search files" className={clsx(inputCls, 'h-7 w-44 py-0 pl-7')} />
                </label>
                <Select<Sort> value={sort} onChange={setSort} options={[{ value: 'date', label: 'Newest first' }, { value: 'name', label: 'By name' }]} className="w-32 [&_select]:h-7 [&_select]:py-0" />
              </>
            }
          >
            {shown.length === 0 ? (
              <Empty>{q ? `No files match "${query}".` : `Nothing filed under ${label} yet.`}</Empty>
            ) : (
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-zinc-100 text-left text-[11.5px] font-medium tracking-wide text-zinc-500 uppercase">
                    <th className="min-w-[220px] px-3.5 py-2">Name</th>
                    <th className="w-px px-2 py-2">Category</th>
                    <th className="w-px px-2 py-2">Source</th>
                    <th className="hidden w-[22%] px-2 py-2 md:table-cell">Workstream</th>
                    <th className="w-px px-2 py-2">Uploaded by</th>
                    <th className="w-px px-2 py-2">Date</th>
                    <th className="w-px px-3.5 py-2 text-right">Size</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {shown.map((f) => (
                    <FileRow key={f.id} view={view} file={f} selected={selected?.id === f.id} hovered={hoverId === f.id} onHover={setHoverId} onSelect={() => setSelectedId(selected?.id === f.id ? null : f.id)} />
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          {selected && <DetailPanel view={view} file={selected} canManage={canManage} onMove={() => setMoving(true)} onClose={() => setSelectedId(null)} />}
        </div>
      </div>

      {adding && <AddFilesModal view={view} initialFolder={folder} onClose={() => setAdding(false)} />}
      {moving && selected && <MoveModal view={view} file={selected} onClose={() => setMoving(false)} />}
    </div>
  )
}

// ---------------------------------------------------------------- Folder tree

function TreeNode({ node, depth, active, collapsed, onToggle, onSelect }: { node: FolderNode; depth: number; active: string; collapsed: Record<string, boolean>; onToggle: (key: string) => void; onSelect: (key: string) => void }) {
  const open = !collapsed[node.key]
  const hasChildren = node.children.length > 0
  return (
    <div>
      <div className={clsx('group flex h-7 items-center gap-1 pr-2', active === node.key ? 'bg-accent-soft text-accent' : 'text-zinc-700 hover:bg-zinc-50')} style={{ paddingLeft: 6 + depth * 14 }}>
        {hasChildren ? (
          <button type="button" onClick={() => onToggle(node.key)} aria-label={`${open ? 'Collapse' : 'Expand'} ${node.label}`} className="rounded p-0.5 text-zinc-400 hover:text-zinc-700">
            {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          </button>
        ) : (
          <span className="size-4.5" />
        )}
        <button type="button" onClick={() => onSelect(node.key)} className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-[13px]">
          <FolderOpen className={clsx('size-3.5 shrink-0', active === node.key ? 'text-accent' : 'text-zinc-400')} />
          <span className={clsx('min-w-0 flex-1 truncate', active === node.key && 'font-medium')}>{node.label}</span>
          <span className="tabular shrink-0 text-[11px] text-zinc-400">{node.count}</span>
        </button>
      </div>
      {hasChildren && open && node.children.map((c) => <TreeNode key={c.key} node={c} depth={depth + 1} active={active} collapsed={collapsed} onToggle={onToggle} onSelect={onSelect} />)}
    </div>
  )
}

// ---------------------------------------------------------------- Rows

function FileRow({ view, file: f, selected, hovered, onHover, onSelect }: { view: View; file: LibraryFile; selected: boolean; hovered: boolean; onHover: (id: string | null) => void; onSelect: () => void }) {
  const by = userName(view, f.uploadedBy)
  return (
    <tr
      data-file-id={f.id}
      onMouseEnter={() => onHover(f.id)}
      onMouseLeave={() => onHover(null)}
      onClick={onSelect}
      className={clsx('cursor-pointer', selected ? 'bg-accent-soft/60' : 'hover:bg-zinc-50')}
    >
      <td className="relative max-w-0 px-3.5 py-2">
        <div className="flex items-center gap-2">
          <File className="size-3.5 shrink-0 text-zinc-400" />
          <span className="truncate font-medium text-zinc-800">{f.name}</span>
        </div>
        {hovered && !selected && (
          <div role="tooltip" className="pointer-events-none absolute top-full left-3 z-20 mt-0.5 w-max max-w-[600px] rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-[12px] whitespace-normal text-zinc-600 shadow-lg">
            <Trail file={f} />
          </div>
        )}
      </td>
      <td className="px-2 py-2 whitespace-nowrap text-zinc-600">{f.category}</td>
      <td className="px-2 py-2 whitespace-nowrap text-zinc-600">{SOURCE_LABEL[f.source]}</td>
      <td className="hidden max-w-0 px-2 py-2 md:table-cell">
        <span className="block truncate text-zinc-600">{f.workstream ? `${f.workstream.pillar.num}. ${f.workstream.pillar.name}${f.workstream.sub ? ` › ${f.workstream.sub.name}` : ''}` : '—'}</span>
      </td>
      <td className="px-2 py-2 whitespace-nowrap">
        <span className="inline-flex items-center gap-1.5">
          <Avatar name={by} size={18} />
          <span className="text-zinc-700">{by}</span>
        </span>
      </td>
      <td className="px-2 py-2 whitespace-nowrap text-zinc-500" title={relTime(f.date)}>
        {fmtDateYear(f.date)}
      </td>
      <td className="tabular px-3.5 py-2 text-right whitespace-nowrap text-zinc-500">{fmtSize(f.size)}</td>
    </tr>
  )
}

function Trail({ file, links }: { file: LibraryFile; links?: boolean }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1 gap-y-0.5">
      {file.trail.map((t, i) => (
        <span key={i} className="inline-flex items-center gap-1">
          {i > 0 && <span className="text-zinc-300">›</span>}
          {links && t.to ? (
            <Link to={t.to} className="text-accent hover:underline">
              {t.label}
            </Link>
          ) : (
            <span className={i === file.trail.length - 1 ? 'text-zinc-800' : undefined}>{t.label}</span>
          )}
        </span>
      ))}
    </span>
  )
}

// ---------------------------------------------------------------- Detail

function DetailPanel({ view, file: f, canManage, onMove, onClose }: { view: View; file: LibraryFile; canManage: boolean; onMove: () => void; onClose: () => void }) {
  const noteTitle = f.origin.kind === 'update' ? 'The update it was attached to' : f.origin.kind === 'ask' ? 'The request it belongs to' : 'Note'
  // No link when the update's workstream has been retired or removed: there is no pillar page left to open it on.
  const openUpdate = f.origin.kind === 'update' ? updateLink(view, f.origin.update) : undefined
  return (
    <Card
      title={
        <>
          <Paperclip className="size-3.5 text-zinc-400" />
          <span className="truncate">{f.name}</span>
        </>
      }
      action={
        <>
          {canManage && (
            <Button size="xs" variant="secondary" icon={<FolderInput className="size-3.5" />} onClick={onMove}>
              Move to folder
            </Button>
          )}
          <button type="button" onClick={onClose} aria-label="Close detail" className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
            <X className="size-4" />
          </button>
        </>
      }
    >
      <div className="space-y-3 text-[13px]">
        <div>
          <div className="mb-1 text-[11.5px] font-medium tracking-wide text-zinc-500 uppercase">Trail</div>
          <Trail file={f} links />
          {f.retagged && <div className="mt-1 text-[11.5px] text-zinc-400">Filed under a different workstream than where it was posted.</div>}
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
          <Meta label="Category">{f.category}</Meta>
          <Meta label="Source">{SOURCE_LABEL[f.source]}</Meta>
          <Meta label="Uploaded by">
            <span className="inline-flex items-center gap-1.5">
              <Avatar name={userName(view, f.uploadedBy)} size={18} />
              {userName(view, f.uploadedBy)}
            </span>
          </Meta>
          <Meta label="Date and size">
            {fmtDateYear(f.date)} · {fmtSize(f.size)}
          </Meta>
        </dl>
        {f.note && (
          <div>
            <div className="mb-1 text-[11.5px] font-medium tracking-wide text-zinc-500 uppercase">{noteTitle}</div>
            <p className="whitespace-pre-wrap text-zinc-700">{f.note}</p>
          </div>
        )}
        {f.origin.kind === 'ask' && (
          <Link to={`/c/${view.company.id}/asks/${f.origin.ask.id}`} className="inline-block text-accent hover:underline">
            Open the request
          </Link>
        )}
        {f.origin.kind === 'update' && (openUpdate ? (
          <Link to={openUpdate} className="inline-block text-accent hover:underline">
            Open the update
          </Link>
        ) : (
          <div className="text-[11.5px] text-zinc-400">Posted on a workstream that is no longer in the plan; the update itself is not shown anywhere.</div>
        ))}
      </div>
    </Card>
  )
}

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[11.5px] text-zinc-400">{label}</dt>
      <dd className="mt-0.5 text-zinc-700">{children}</dd>
    </div>
  )
}

// ---------------------------------------------------------------- Forms

/** One grouped select for "where does this go": a document type or a workstream. */
function FolderSelect({ view, value, onChange, includeNone, noneLabel, includeTypes }: { view: View; value: string; onChange: (v: string) => void; includeNone?: boolean; noneLabel?: string; includeTypes?: boolean }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={clsx(inputCls, 'appearance-none')}>
      {includeNone && <option value="">{noneLabel ?? 'None'}</option>}
      {includeTypes && (
        <optgroup label="Deal materials">
          {DOC_TYPES.map((t) => (
            <option key={t} value={`type:${t}`}>
              {t}
            </option>
          ))}
        </optgroup>
      )}
      <optgroup label="Workstreams">
        {workstreamOptions(view).map((o) => (
          <option key={o.value} value={`ws:${o.value}`}>
            {o.label}
          </option>
        ))}
      </optgroup>
    </select>
  )
}

function parseChoice(view: View, choice: string): { type: DocType; workstream: WorkstreamRef | null } {
  if (choice.startsWith('type:')) return { type: choice.slice(5) as DocType, workstream: null }
  if (choice.startsWith('ws:')) {
    const ref = workstreamOptions(view).find((o) => o.value === choice.slice(3))?.ref ?? null
    return { type: 'Other', workstream: ref }
  }
  return { type: 'Other', workstream: null }
}

function PickedList({ files, onRemove }: { files: Picked[]; onRemove: (i: number) => void }) {
  if (!files.length) return null
  return (
    <ul className="mt-2 space-y-1">
      {files.map((f, i) => (
        <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-md border border-zinc-200 px-2.5 py-1 text-[12.5px]">
          <File className="size-3.5 text-zinc-400" />
          <span className="min-w-0 flex-1 truncate">{f.name}</span>
          <span className="text-[11px] text-zinc-400">{fmtSize(f.size)}</span>
          <button type="button" onClick={() => onRemove(i)} aria-label={`Remove ${f.name}`} className="rounded p-0.5 text-zinc-400 hover:text-zinc-700">
            <X className="size-3.5" />
          </button>
        </li>
      ))}
    </ul>
  )
}

function AddFilesModal({ view, initialFolder, onClose }: { view: View; initialFolder: string; onClose: () => void }) {
  const addDocuments = useStore((s) => s.addDocuments)
  const showToast = useStore((s) => s.showToast)
  const initial = initialFolder.startsWith('materials:') ? `type:${initialFolder.slice(10)}` : initialFolder.startsWith('ws:') ? initialFolder : 'type:Other'
  const [choice, setChoice] = useState(initial)
  const [files, setFiles] = useState<Picked[]>([])
  const [note, setNote] = useState('')
  const submit = () => {
    const { type, workstream } = parseChoice(view, choice)
    addDocuments(view.company.id, files, type, workstream, note)
    showToast(`Added ${files.length} file${files.length === 1 ? '' : 's'}`)
    onClose()
  }
  return (
    <Modal
      open
      onClose={onClose}
      title="Add files"
      width={480}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!files.length} onClick={submit}>
            Add {files.length ? `${files.length} file${files.length === 1 ? '' : 's'}` : 'files'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <div className="mb-1 text-xs font-medium text-zinc-600">Files</div>
          <FilePicker icon={<Paperclip className="size-3.5" />} onFiles={(fs) => setFiles((cur) => [...cur, ...fs.map((f) => ({ name: f.name, size: f.size }))])}>
            Choose files
          </FilePicker>
          <PickedList files={files} onRemove={(i) => setFiles((cur) => cur.filter((_, j) => j !== i))} />
          <div className="mt-1 text-[11.5px] text-zinc-400">Recorded by name and size; the demo does not keep file contents.</div>
        </div>
        <Field label="Folder" hint="A workstream folder also lists the file under Deal materials › Other.">
          <FolderSelect view={view} value={choice} onChange={setChoice} includeTypes />
        </Field>
        <Field label="Note (optional)">
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} placeholder="What this is and why it matters" />
        </Field>
      </div>
    </Modal>
  )
}

function MoveModal({ view, file: f, onClose }: { view: View; file: LibraryFile; onClose: () => void }) {
  const moveFile = useStore((s) => s.moveFile)
  const showToast = useStore((s) => s.showToast)
  const isDoc = f.origin.kind === 'document'
  const currentWs = f.workstream ? `ws:${f.workstream.sub?.id ?? f.workstream.pillar.id}` : ''
  const [type, setType] = useState<DocType>(isDoc && f.origin.kind === 'document' ? f.origin.document.type : 'Other')
  const [ws, setWs] = useState(isDoc ? currentWs : f.retagged ? currentWs : '')
  const submit = () => {
    const workstream = ws ? parseChoice(view, ws).workstream : null
    moveFile(f.id, isDoc ? { type, workstream } : { workstream })
    showToast(`Moved ${f.name}`)
    onClose()
  }
  return (
    <Modal
      open
      onClose={onClose}
      title="Move to folder"
      width={440}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit}>
            Move
          </Button>
        </>
      }
    >
      <p className="mb-3 truncate text-[12.5px] text-zinc-500" title={f.name}>
        {f.name}
      </p>
      <div className="space-y-3">
        {isDoc && (
          <Field label="Document type">
            <Select<DocType> value={type} onChange={setType} options={DOC_TYPES} />
          </Field>
        )}
        <Field label="Workstream" hint={isDoc ? 'Optional. Files the document under that pillar as well.' : 'The file stays on its update or request; this only changes the folder it is filed under.'}>
          <FolderSelect view={view} value={ws} onChange={setWs} includeNone noneLabel={isDoc ? 'None' : 'Where it was posted'} />
        </Field>
      </div>
    </Modal>
  )
}

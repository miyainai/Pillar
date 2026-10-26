import { useState } from 'react'
import clsx from 'clsx'
import { Paperclip, Send, Sparkles, X } from 'lucide-react'
import type { Ask } from '../lib/types'
import type { View } from '../lib/permissions'
import { PeoplePicker } from './PeoplePicker'
import { useStore } from '../lib/store'
import { fmtSize, userName } from '../lib/selectors'
import { suggestMgmtVersion, suggestionNote } from '../lib/ai'
import { BACK_REASONS, RESOLVE_REASONS, columnLabel, statusForColumn, type ColumnKey, type MoveKind } from '../lib/askBoard'
import { Button, Field, FilePicker, Modal, inputCls } from './ui'

/**
 * The small forms that open when an ask is moved on the board (or from its page).
 * Each one ends in an existing store transition, so the ask page, dashboards and activity all update.
 */
export function AskMoveModal({ view, a, kind, to, onClose }: { view: View; a: Ask; kind: MoveKind; to: ColumnKey; onClose: () => void }) {
  switch (kind) {
    case 'back':
      return <SendBackModal view={view} a={a} to={to === 'new' ? 'new' : 'team'} onClose={onClose} />
    case 'pickup':
      return <PickUpModal view={view} a={a} onClose={onClose} />
    case 'route':
      return <RouteModal view={view} a={a} onClose={onClose} />
    case 'deliver':
      return <DeliverModal view={view} a={a} onClose={onClose} />
    case 'answer':
      return <AnswerModal view={view} a={a} onClose={onClose} />
    case 'resolve':
      return <ResolveModal view={view} a={a} onClose={onClose} />
  }
}

function AskLine({ a }: { a: Ask }) {
  return <div className="mb-3 rounded-md bg-zinc-50 px-2.5 py-2 text-[13px] font-medium text-zinc-800">{a.title}</div>
}

type Picked = File

function PickedFiles({ files, onRemove }: { files: Picked[]; onRemove: (i: number) => void }) {
  if (!files.length) return null
  return (
    <ul className="mt-1.5 space-y-1">
      {files.map((f, i) => (
        <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded border border-zinc-200 px-2 py-1 text-[12.5px]">
          <Paperclip className="size-3.5 text-zinc-400" />
          <span className="min-w-0 flex-1 truncate">{f.name}</span>
          <span className="text-[11px] text-zinc-400">{fmtSize(f.size)}</span>
          <button type="button" onClick={() => onRemove(i)} className="text-zinc-400 hover:text-zinc-700" aria-label={`Remove ${f.name}`}>
            <X className="size-3.5" />
          </button>
        </li>
      ))}
    </ul>
  )
}

// ---------------------------------------------------------------- New -> With deal team

function PickUpModal({ view, a, onClose }: { view: View; a: Ask; onClose: () => void }) {
  const s = useStore()
  const dealMembers = view.members.filter((m) => ['MD', 'Principal', 'VP', 'Associate'].includes(m.role))
  const [assignees, setAssignees] = useState(a.assigneeIds)
  const [note, setNote] = useState('')
  const who = assignees.map((id) => userName(view, id).split(' ')[0]).join(' and ')
  return (
    <Modal open onClose={onClose} title="Move to With deal team" width={460}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!assignees.length} onClick={() => {
            if (assignees.join() !== a.assigneeIds.join()) s.patchAsk(a.id, { assigneeIds: assignees })
            s.transitionAsk(a.id, 'In progress', note.trim() || undefined)
            s.showToast(`${who} ${assignees.length > 1 ? 'are' : 'is'} on it`)
            onClose()
          }}>
            Move
          </Button>
        </>
      }
    >
      <AskLine a={a} />
      <div className="space-y-3">
        <Field group label="Who is working on it" hint={view.viewer.canReassign ? 'More than one person can be on it.' : 'VP and above can change who this goes to.'}>
          <PeoplePicker people={dealMembers} selected={assignees} onChange={setAssignees} disabled={!view.viewer.canReassign} boxLabel="On it" />
        </Field>
        <Field label="Note (optional)" hint="Shows on the ask's timeline.">
          <textarea autoFocus rows={2} value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} placeholder="e.g. Pulling this from the Q3 model, back by Thursday." />
        </Field>
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------- -> With management

function RouteModal({ view, a, onClose }: { view: View; a: Ask; onClose: () => void }) {
  const s = useStore()
  const mgmtMembers = view.members.filter((m) => m.role === 'Management')
  const [recipient, setRecipient] = useState(a.mgmtAssigneeId ?? mgmtMembers.find((m) => /CFO/.test(m.user.title))?.user.id ?? mgmtMembers[0]?.user.id ?? '')
  const [title, setTitle] = useState(a.mgmtTitle ?? '')
  const [desc, setDesc] = useState(a.mgmtDescription ?? '')
  const [files, setFiles] = useState<Picked[]>([])
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const ok = title.trim() && desc.trim() && recipient
  return (
    <Modal open onClose={onClose} title="Send to management" width={540}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon={<Send className="size-3.5" />} disabled={!ok} onClick={() => {
            s.routeToManagement(a.id, title, desc, recipient)
            if (files.length) s.uploadToAsk(a.id, files, 'context')
            s.showToast(`Sent to ${userName(view, recipient)}`)
            onClose()
          }}>
            Send
          </Button>
        </>
      }
    >
      <AskLine a={a} />
      <p className="mb-3 text-xs text-zinc-500">Management sees only what you write here, never the internal request.</p>
      <div className="space-y-3">
        <Field group label="Send to">
          <PeoplePicker people={mgmtMembers} selected={recipient ? [recipient] : []} onChange={(ids) => setRecipient(ids[0] ?? '')} max={1} boxLabel="Recipient" emptyText="Drag the person at the company who should get this." />
        </Field>
        <div className="flex items-end justify-between gap-2">
          <Field label="Title they will see" className="flex-1">
            <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="Monthly COGS by SKU and supplier, last 24 months" />
          </Field>
          <Button size="sm" variant="ghost" icon={<Sparkles className="size-3.5 text-accent" />} disabled={busy} onClick={async () => {
            setBusy(true)
            const r = await suggestMgmtVersion(a)
            setTitle(r.title)
            setDesc(r.description)
            setNote(suggestionNote(r))
            setBusy(false)
          }}>
            {busy ? 'Drafting…' : 'Draft it for me'}
          </Button>
        </div>
        <Field label="What you are asking for" hint="Exact data, period, format and when you need it. Leave out internal context.">
          <textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} className={inputCls} placeholder="Please send…" />
        </Field>
        {note && <p className="text-[11.5px] text-accent">{note}</p>}
        <div>
          <div className="mb-1 text-xs font-medium text-zinc-600">Files to share with them (optional)</div>
          <FilePicker variant="secondary" icon={<Paperclip className="size-3.5" />} onFiles={(fs) => setFiles((cur) => [...cur, ...fs])}>
            Attach files
          </FilePicker>
          <PickedFiles files={files} onRemove={(i) => setFiles((cur) => cur.filter((_, j) => j !== i))} />
          <div className="mt-1 text-[11.5px] text-zinc-400">A template or an example makes the ask easier to answer.</div>
        </div>
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------- -> Delivered (data request)

function DeliverModal({ view, a, onClose }: { view: View; a: Ask; onClose: () => void }) {
  const s = useStore()
  const requester = userName(view, a.createdBy)
  const [files, setFiles] = useState<Picked[]>([])
  const [note, setNote] = useState('')
  const ok = files.length > 0 || note.trim().length > 0
  return (
    <Modal open onClose={onClose} title={`Deliver to ${requester}`} width={480}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!ok} onClick={() => {
            if (note.trim()) s.transitionAsk(a.id, 'Delivered', note.trim())
            if (files.length) s.uploadToAsk(a.id, files, 'final')
            s.showToast(`Delivered to ${requester}`)
            onClose()
          }}>
            Deliver
          </Button>
        </>
      }
    >
      <AskLine a={a} />
      <div className="space-y-3">
        <div>
          <div className="mb-1 text-xs font-medium text-zinc-600">Final files</div>
          <FilePicker variant="secondary" icon={<Paperclip className="size-3.5" />} onFiles={(fs) => setFiles((cur) => [...cur, ...fs])}>
            Attach files
          </FilePicker>
          <PickedFiles files={files} onRemove={(i) => setFiles((cur) => cur.filter((_, j) => j !== i))} />
          <div className="mt-1 text-[11.5px] text-zinc-400">The cleaned-up version, not the raw upload from management.</div>
        </div>
        <Field label={`Note for ${requester.split(' ')[0]}`} hint={files.length ? 'Optional.' : 'Required if there are no files, so they know where to look.'}>
          <textarea autoFocus rows={2} value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} placeholder="e.g. Tab 2 has the SKU view; two suppliers are missing Q1 and flagged in red." />
        </Field>
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------- -> Delivered (question)

function AnswerModal({ view, a, onClose }: { view: View; a: Ask; onClose: () => void }) {
  const s = useStore()
  const [text, setText] = useState('')
  return (
    <Modal open onClose={onClose} title="Answer the question" width={480}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!text.trim()} onClick={() => {
            s.answerQuestion(a.id, text)
            s.showToast(`Answer sent to ${userName(view, a.createdBy)}`)
            onClose()
          }}>
            Post answer
          </Button>
        </>
      }
    >
      <AskLine a={a} />
      {a.context && <p className="mb-3 text-[12.5px] whitespace-pre-wrap text-zinc-600">{a.context}</p>}
      <Field label="Your answer" hint={`${userName(view, a.createdBy)} gets it and resolves the question.`}>
        <textarea autoFocus rows={4} value={text} onChange={(e) => setText(e.target.value)} className={inputCls} placeholder="Answer in plain words. Link to the model or memo if it helps." />
      </Field>
    </Modal>
  )
}

// ---------------------------------------------------------------- -> Resolved

export function ResolveModal({ view, a, onClose }: { view: View; a: Ask; onClose: () => void }) {
  const s = useStore()
  const [reason, setReason] = useState<(typeof RESOLVE_REASONS)[number]>(RESOLVE_REASONS[0])
  const [note, setNote] = useState('')
  const early = !['Delivered', 'Answered'].includes(a.status)
  const ok = reason !== 'Other' || note.trim().length > 0
  return (
    <Modal open onClose={onClose} title={a.type === 'question' ? 'Resolve question' : 'Resolve request'} width={460}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!ok} onClick={() => {
            s.transitionAsk(a.id, 'Closed', note.trim() ? `${reason}: ${note.trim()}` : reason)
            s.showToast('Resolved')
            onClose()
          }}>
            Resolve
          </Button>
        </>
      }
    >
      <AskLine a={a} />
      {early && <p className="mb-3 text-xs text-amber-700">This has not been delivered yet. Resolving it now takes it off everyone's list.</p>}
      <div className="space-y-3">
        <div role="radiogroup" aria-label="Why is it resolved?">
          <div className="mb-1 text-xs font-medium text-zinc-600">Why is it resolved?</div>
          <div className="flex flex-wrap gap-1.5">
            {RESOLVE_REASONS.map((r) => (
              <button key={r} type="button" role="radio" aria-checked={reason === r} onClick={() => setReason(r)} className={clsx('rounded-full border px-2.5 py-1 text-xs font-medium', reason === r ? 'border-accent bg-accent-soft text-accent' : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50')}>
                {r}
              </button>
            ))}
          </div>
        </div>
        <Field label={reason === 'Other' ? 'Say more' : 'Anything to add? (optional)'} hint="Shows on the ask's timeline.">
          <textarea autoFocus rows={2} value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} placeholder={reason === 'Duplicate of another ask' ? 'Which one?' : 'e.g. Used it in the pricing memo.'} />
        </Field>
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------- Back to an earlier column

/**
 * Moving an ask backwards (reopening it, pulling it back from management, sending a delivery
 * back) always records why and what should happen next, so the person who gets it knows.
 */
export function SendBackModal({ view, a, to, onClose }: { view: View; a: Ask; to: 'new' | 'team'; onClose: () => void }) {
  const s = useStore()
  const dealMembers = view.members.filter((m) => ['MD', 'Principal', 'VP', 'Associate'].includes(m.role))
  const [reason, setReason] = useState<(typeof BACK_REASONS)[number]>(a.status === 'Closed' ? 'Reopening' : BACK_REASONS[0])
  const [why, setWhy] = useState('')
  const [next, setNext] = useState('')
  const [assignees, setAssignees] = useState(a.assigneeIds)
  const status = statusForColumn(a, to)
  const ok = why.trim().length > 0
  const fromMgmt = a.status === 'Sent to management'
  const title = a.status === 'Closed' ? 'Reopen' : fromMgmt ? 'Pull back from management' : `Send back to ${columnLabel(to)}`
  return (
    <Modal open onClose={onClose} title={title} width={480}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!ok} onClick={() => {
            if (to === 'team' && assignees.length && assignees.join() !== a.assigneeIds.join()) s.patchAsk(a.id, { assigneeIds: assignees })
            const note = [`${reason}: ${why.trim()}`, next.trim() ? `Next: ${next.trim()}` : ''].filter(Boolean).join(' — ')
            s.transitionAsk(a.id, status, note)
            s.showToast(to === 'team' ? `Back with ${assignees.map((id) => userName(view, id).split(' ')[0]).join(' and ')}` : 'Back in New')
            onClose()
          }}>
            {a.status === 'Closed' ? 'Reopen' : 'Send back'}
          </Button>
        </>
      }
    >
      <AskLine a={a} />
      {fromMgmt && <p className="mb-3 text-xs text-amber-700">Management will no longer see this as waiting on them.</p>}
      <div className="space-y-3">
        <div role="radiogroup" aria-label="Why is it going back?">
          <div className="mb-1 text-xs font-medium text-zinc-600">Why is it going back?</div>
          <div className="flex flex-wrap gap-1.5">
            {BACK_REASONS.map((r) => (
              <button key={r} type="button" role="radio" aria-checked={reason === r} onClick={() => setReason(r)} className={clsx('rounded-full border px-2.5 py-1 text-xs font-medium', reason === r ? 'border-accent bg-accent-soft text-accent' : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50')}>
                {r}
              </button>
            ))}
          </div>
        </div>
        <Field label="Say more" hint="Required. Shows on the ask's timeline so the next person knows what happened.">
          <textarea autoFocus rows={2} value={why} onChange={(e) => setWhy(e.target.value)} className={inputCls} placeholder="e.g. The file only covers 8 of the 14 branches." />
        </Field>
        <Field label="Next steps (optional)">
          <textarea rows={2} value={next} onChange={(e) => setNext(e.target.value)} className={inputCls} placeholder="e.g. Ask Elena for the remaining branches, then rebuild the ranking." />
        </Field>
        {to === 'team' && (
          <Field group label="Who picks it up" hint={view.viewer.canReassign ? undefined : 'VP and above can change who this goes to.'}>
            <PeoplePicker people={dealMembers} selected={assignees} onChange={setAssignees} disabled={!view.viewer.canReassign} boxLabel="On it" />
          </Field>
        )}
      </div>
    </Modal>
  )
}

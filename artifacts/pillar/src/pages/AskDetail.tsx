import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import clsx from 'clsx'
import { ArrowLeft, CheckCircle2, Database, Flag, HelpCircle, Paperclip, Send, Sparkles, Undo2 } from 'lucide-react'
import { useStore } from '../lib/store'
import type { View } from '../lib/permissions'
import { URGENCIES, type Ask, type Attachment, type Urgency } from '../lib/types'
import { isOverdue, useView, userName } from '../lib/selectors'
import { addHours, fmtDateTime, fromInputDate, relTime, toInputDate } from '../lib/dates'
import { suggestMgmtVersion, suggestionNote } from '../lib/ai'
import { AskStatusPill, Avatar, AvatarStack, Button, Card, Empty, Field, FilePicker, Modal, Select, UrgencyBadge, inputCls } from '../components/ui'
import { AttachmentRow } from '../components/AttachmentRow'
import { PeoplePicker } from '../components/PeoplePicker'
import { Comments } from '../components/Comments'
import { ResolveModal, SendBackModal } from '../components/AskMoves'

export default function AskDetail() {
  const { askId } = useParams()
  const view = useView()
  if (!view) return null
  const a = view.asks.find((x) => x.id === askId)
  if (!a)
    return (
      <div className="mt-20 text-center text-zinc-500">
        Request not found.{' '}
        <Link className="text-accent" to={`/c/${view.company.id}/asks`}>
          Back to asks
        </Link>
      </div>
    )
  return <AskDetailInner key={a.id} view={view} a={a} />
}

function AskDetailInner({ view, a }: { view: View; a: Ask }) {
  const s = useStore()
  const { viewer } = view
  const me = viewer.user.id
  const mgmt = viewer.isMgmt
  const dealTeam = viewer.canTriageAsks
  const isDR = a.type === 'data_request'
  const pillar = view.pillars.find((p) => p.id === a.pillarId)
  const sub = view.subPillars.find((x) => x.id === a.subPillarId)
  const overdue = isOverdue(a)
  const routed = !!a.mgmtAssigneeId
  const mgmtMembers = view.members.filter((m) => m.role === 'Management')
  const dealMembers = view.members.filter((m) => ['MD', 'Principal', 'VP', 'Associate'].includes(m.role))
  const [flagOpen, setFlagOpen] = useState(false)
  const [resolveOpen, setResolveOpen] = useState(false)
  const [backTo, setBackTo] = useState<'new' | 'team' | null>(null)
  const delivered = a.status === 'Delivered' || a.status === 'Answered'
  // Whose court it is in right now.
  const courtIds = a.status === 'Closed' ? [] : a.status === 'Sent to management' ? [a.mgmtAssigneeId!] : delivered ? [a.createdBy] : a.assigneeIds
  const courtNote = a.status === 'Sent to management' ? 'to upload the file' : delivered ? 'to check it and resolve' : a.status === 'New' || a.status === 'Open' ? 'to pick it up' : 'working on it'

  return (
    <div>
      <Link to={`/c/${view.company.id}/asks`} className="mb-3 inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800">
        <ArrowLeft className="size-3" /> {mgmt ? 'Data requests' : 'Asks'}
      </Link>

      {a.flaggedToMd && !a.flagResolvedAt && !mgmt && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-800">
          <Flag className="size-4" />
          <span>
            <span className="font-semibold">Flagged to MD</span> by {userName(view, a.flaggedBy)} {a.flaggedAt && relTime(a.flaggedAt)}: {a.flagNote}
          </span>
          {(viewer.role === 'MD' || viewer.role === 'Principal') && a.type === 'data_request' && (
            <Button size="xs" className="ml-auto" onClick={() => s.resolveFlag('ask', a.id)}>
              Mark resolved
            </Button>
          )}
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-1.5 text-xs text-zinc-500">
            {isDR ? <Database className="size-3.5" /> : <HelpCircle className="size-3.5" />}
            {isDR ? 'Data request' : 'Question'}
            {pillar && (
              <>
                <span>·</span>
                <Link to={`/c/${view.company.id}/pillars/${pillar.id}`} className="hover:text-zinc-800 hover:underline">
                  {sub ? `${sub.num} ${sub.name}` : `${pillar.num}. ${pillar.name}`}
                </Link>
              </>
            )}
          </div>
          <h1 className="text-[19px] font-semibold tracking-tight">{a.title}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            <AskStatusPill status={a.status} mgmt={mgmt} />
            <UrgencyBadge urgency={a.urgency} />
            <span className={overdue ? 'font-semibold text-red-600' : ''}>
              {overdue ? 'Overdue · was due' : 'Due'} {new Date(a.dueDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
            <span>·</span>
            <span>
              {mgmt ? 'From' : 'Opened by'} {userName(view, a.createdBy)} {relTime(a.createdAt)}
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title={mgmt ? 'Request' : isDR ? 'Request (internal)' : 'Context'}>
            <p className="text-[13px] whitespace-pre-wrap text-zinc-800">{(isDR ? a.description : a.context) || <span className="text-zinc-400">No details.</span>}</p>
          </Card>

          {isDR && !mgmt && <MgmtVersionEditor view={view} a={a} mgmtMembers={mgmtMembers} />}

          {!isDR && <AnswerBox view={view} a={a} />}

          {isDR && <AttachmentsByStage view={view} a={a} />}

          <Card title="Comments">
            <Comments
              view={view}
              parentType="ask"
              parentId={a.id}
              parentShared={isDR && routed}
              lockedHint={isDR ? 'Shared comments open up once this is routed to management.' : 'Questions stay inside the firm.'}
            />
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Actions">
            <div className="flex flex-col gap-2">
              {/* Deal team triage */}
              {dealTeam && isDR && a.status === 'New' && (
                <Button variant="secondary" onClick={() => s.transitionAsk(a.id, 'In progress')}>
                  Start working on it
                </Button>
              )}
              {dealTeam && isDR && ['New', 'In progress', 'Data received'].includes(a.status) && (
                <FilePicker
                  variant={a.status === 'Data received' ? 'primary' : 'secondary'}
                  icon={<CheckCircle2 className="size-3.5" />}
                  onFiles={(files) => {
                    s.uploadToAsk(a.id, files, 'final')
                    s.showToast('Delivered to ' + userName(view, a.createdBy))
                  }}
                >
                  {a.status === 'Data received' ? 'Upload the cleaned file and deliver' : 'Upload the final file and deliver'}
                </FilePicker>
              )}
              {dealTeam && isDR && ['New', 'In progress'].includes(a.status) && (
                <Button
                  variant="ghost"
                  icon={<Send className="size-3.5" />}
                  onClick={() => document.getElementById('mgmt-version')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                >
                  Send to management…
                </Button>
              )}
              {!mgmt && a.status === 'Sent to management' && (
                <p className="text-[12.5px] text-zinc-500">
                  Waiting on <span className="font-medium text-zinc-700">{userName(view, a.mgmtAssigneeId)}</span> to upload. It moves back to the deal team on its own when the file lands.
                </p>
              )}
              {/* Management */}
              {mgmt && a.status === 'Sent to management' && (
                <FilePicker
                  variant="primary"
                  icon={<Paperclip className="size-3.5" />}
                  onFiles={(files) => {
                    s.uploadToAsk(a.id, files, 'raw')
                    s.showToast('Uploaded. The deal team has been notified.')
                  }}
                >
                  Upload file
                </FilePicker>
              )}
              {mgmt && a.status !== 'Sent to management' && <p className="text-[12.5px] text-zinc-500">Thanks, your upload is with the deal team.</p>}
              {/* Requester closes */}
              {!mgmt && a.status === 'Delivered' && (a.createdBy === me || dealTeam) && (
                <Button variant="primary" onClick={() => setResolveOpen(true)}>
                  Got it, resolve
                </Button>
              )}
              {!mgmt && a.status === 'Answered' && (a.createdBy === me || dealTeam) && (
                <Button variant="primary" onClick={() => setResolveOpen(true)}>
                  Got it, resolve
                </Button>
              )}
              {dealTeam && !['Delivered', 'Answered', 'Closed'].includes(a.status) && (
                <Button variant="ghost" onClick={() => setResolveOpen(true)}>
                  Resolve without delivering…
                </Button>
              )}
              {/* Backwards: always with a reason, so the next person knows why */}
              {!mgmt && delivered && (a.createdBy === me || dealTeam) && (
                <Button variant="ghost" icon={<Undo2 className="size-3.5" />} onClick={() => setBackTo('team')}>
                  Send back to the deal team…
                </Button>
              )}
              {dealTeam && a.status === 'Sent to management' && (
                <Button variant="ghost" icon={<Undo2 className="size-3.5" />} onClick={() => setBackTo('team')}>
                  Pull back from management…
                </Button>
              )}
              {dealTeam && a.status === 'Closed' && (
                <Button variant="secondary" icon={<Undo2 className="size-3.5" />} onClick={() => setBackTo('team')}>
                  Reopen…
                </Button>
              )}
              {/* Flag */}
              {dealTeam && viewer.role !== 'MD' && !(a.flaggedToMd && !a.flagResolvedAt) && a.status !== 'Closed' && (
                <Button variant="danger" icon={<Flag className="size-3.5" />} onClick={() => setFlagOpen(true)}>
                  Flag to MD
                </Button>
              )}
              {!mgmt && ['Closed'].includes(a.status) && <p className="text-[12.5px] text-zinc-500">Resolved {a.closedAt && relTime(a.closedAt)}.</p>}
              {!dealTeam && !mgmt && !['Delivered', 'Answered', 'Closed'].includes(a.status) && (
                <p className="text-[12.5px] text-zinc-500">With {names(view, a.assigneeIds)} on the deal team.</p>
              )}
            </div>
          </Card>

          {!mgmt && (
            <Card title="Details">
              <div className="space-y-3">
                <div className="rounded-md bg-zinc-50 px-2.5 py-2 text-[12.5px]">
                  <div className="flex items-center gap-2">
                    <span className="w-16 shrink-0 text-zinc-500">Court</span>
                    {courtIds.length ? (
                      <span className="flex min-w-0 items-center gap-1.5">
                        <AvatarStack names={courtIds.map((id) => userName(view, id))} size={18} />
                        <span className="truncate font-medium text-zinc-800">{names(view, courtIds)}</span>
                        <span className="truncate text-zinc-500">{courtNote}</span>
                      </span>
                    ) : (
                      <span className="text-zinc-500">Nobody, it is resolved</span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="w-16 shrink-0 text-zinc-500">Asked by</span>
                    <span className="flex min-w-0 items-center gap-1.5">
                      <Avatar name={userName(view, a.createdBy)} size={18} />
                      <span className="truncate font-medium text-zinc-800">{userName(view, a.createdBy)}</span>
                    </span>
                  </div>
                </div>
                <Field group label="Deal team owners" hint={viewer.canReassign ? 'New asks go to the associate. Drag people in or out to change who is on it.' : undefined}>
                  {viewer.canReassign ? (
                    <PeoplePicker people={dealMembers} selected={a.assigneeIds} onChange={(ids) => ids.length && s.patchAsk(a.id, { assigneeIds: ids })} boxLabel="On it" />
                  ) : (
                    <div className="space-y-1.5">
                      {a.assigneeIds.map((id) => (
                        <div key={id} className="flex items-center gap-2 text-[13px]">
                          <Avatar name={userName(view, id)} size={20} />
                          <span>
                            <span className="block">{userName(view, id)}</span>
                            <span className="block text-xs text-zinc-500">{view.members.find((m) => m.user.id === id)?.user.title}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Urgency">
                    <Select<Urgency>
                      disabled={!dealTeam && a.createdBy !== me}
                      value={a.urgency}
                      onChange={(u) => s.patchAsk(a.id, { urgency: u, dueDate: addHours(a.createdAt, view.settings.urgencyHours[u]) })}
                      options={URGENCIES}
                    />
                  </Field>
                  <Field label="Due date">
                    <input
                      type="date"
                      disabled={!dealTeam && a.createdBy !== me}
                      value={toInputDate(a.dueDate)}
                      onChange={(e) => e.target.value && s.patchAsk(a.id, { dueDate: fromInputDate(e.target.value, true) })}
                      className={inputCls}
                    />
                  </Field>
                </div>
                {routed && (
                  <div className="text-xs text-zinc-500">
                    Sent to <span className="font-medium text-zinc-700">{userName(view, a.mgmtAssigneeId)}</span>
                    {a.mgmtApprovedBy && <> · management version by {userName(view, a.mgmtApprovedBy)}</>}
                  </div>
                )}
              </div>
            </Card>
          )}

          <Card title="Status timeline">
            <ol className="relative space-y-3 border-l border-zinc-200 pl-4">
              {a.history.map((h, i) => (
                <li key={i} className="relative">
                  <span className={clsx('absolute top-1 -left-[21px] size-2.5 rounded-full border-2 border-white', i === a.history.length - 1 ? 'bg-accent' : 'bg-zinc-300')} />
                  <div className="text-[12.5px] font-medium">{mgmt ? statusForMgmt(h.status) : h.status === 'Closed' ? 'Resolved' : h.status}</div>
                  <div className="text-[11.5px] text-zinc-500">
                    {userName(view, h.by)} · {fmtDateTime(h.at)}
                  </div>
                  {h.note && <div className="mt-0.5 rounded bg-zinc-50 px-2 py-1 text-[12px] whitespace-pre-wrap text-zinc-700">{h.note}</div>}
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>

      <FlagModal open={flagOpen} onClose={() => setFlagOpen(false)} onFlag={(note) => s.flagToMd('ask', a.id, note)} />
      {resolveOpen && <ResolveModal view={view} a={a} onClose={() => setResolveOpen(false)} />}
      {backTo && <SendBackModal view={view} a={a} to={backTo} onClose={() => setBackTo(null)} />}
    </div>
  )
}

function statusForMgmt(s: string) {
  if (s === 'Sent to management') return 'Requested'
  if (s === 'Data received') return 'Uploaded'
  if (s === 'Delivered') return 'Used by the deal team'
  return s
}

function MgmtVersionEditor({ view, a, mgmtMembers }: { view: View; a: Ask; mgmtMembers: View['members'] }) {
  const s = useStore()
  const canEdit = view.viewer.canTriageAsks && ['New', 'In progress'].includes(a.status)
  const routed = !!a.mgmtAssigneeId
  const [title, setTitle] = useState(a.mgmtTitle ?? '')
  const [desc, setDesc] = useState(a.mgmtDescription ?? '')
  const [recipient, setRecipient] = useState(a.mgmtAssigneeId ?? mgmtMembers.find((m) => /CFO/.test(m.user.title))?.user.id ?? mgmtMembers[0]?.user.id ?? '')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  useEffect(() => {
    setTitle(a.mgmtTitle ?? '')
    setDesc(a.mgmtDescription ?? '')
  }, [a.mgmtTitle, a.mgmtDescription])

  if (!routed && !canEdit) {
    if (['Delivered', 'Closed'].includes(a.status)) return null
    return (
      <Card title="Management version">
        <p className="text-[12.5px] text-zinc-500">If this needs to go to the company, the deal team writes a version for management here. Management never sees the internal request above.</p>
      </Card>
    )
  }

  return (
    <div id="mgmt-version">
      <Card
        title={
          <>
            Management version{' '}
            <span className="text-xs font-normal text-zinc-400">{routed ? `sent to ${userName(view, a.mgmtAssigneeId)}` : 'what management will see instead of the request above'}</span>
          </>
        }
        action={
          canEdit && (
            <Button
              size="xs"
              variant="ghost"
              icon={<Sparkles className="size-3.5 text-accent" />}
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                const r = await suggestMgmtVersion(a)
                setTitle(r.title)
                setDesc(r.description)
                setNote(suggestionNote(r))
                setBusy(false)
              }}
            >
              {busy ? 'Drafting…' : 'Draft it for me'}
            </Button>
          )
        }
      >
        {routed ? (
          <div className="rounded-md border border-violet-100 bg-violet-50/50 p-3">
            <div className="text-[13px] font-medium">{a.mgmtTitle}</div>
            <p className="mt-0.5 text-[13px] text-zinc-700">{a.mgmtDescription}</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            <Field label="Title for management">
              <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="Monthly COGS by SKU and supplier, last 24 months" />
            </Field>
            <Field label="Request for management" hint="Drop internal context. Keep the exact data, period, format, and due date.">
              <textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} className={inputCls} placeholder="Please send…" />
            </Field>
            {note && <p className="text-[11.5px] text-accent">{note}</p>}
            <div className="flex flex-wrap items-end gap-2">
              <Field group label="Send to" className="w-full">
                <PeoplePicker people={mgmtMembers} selected={recipient ? [recipient] : []} onChange={(ids) => setRecipient(ids[0] ?? '')} max={1} boxLabel="Recipient" emptyText="Drag the person at the company who should get this." />
              </Field>
              <Button
                variant="ghost"
                disabled={!title.trim()}
                onClick={() => {
                  s.patchAsk(a.id, { mgmtTitle: title.trim(), mgmtDescription: desc.trim() })
                  s.showToast('Draft saved')
                }}
              >
                Save draft
              </Button>
              <Button
                variant="primary"
                icon={<Send className="size-3.5" />}
                disabled={!title.trim() || !desc.trim() || !recipient}
                onClick={() => {
                  s.routeToManagement(a.id, title, desc, recipient)
                  s.showToast(`Sent to ${userName(view, recipient)}`)
                }}
              >
                Send to management
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

function AnswerBox({ view, a }: { view: View; a: Ask }) {
  const answerQuestion = useStore((s) => s.answerQuestion)
  const [text, setText] = useState('')
  const canAnswer = view.viewer.canTriageAsks && (a.status === 'Open' || a.status === 'In progress')
  return (
    <Card title="Answer">
      {a.answer ? (
        <div className="flex gap-2.5">
          <Avatar name={userName(view, a.answeredBy)} size={22} />
          <div>
            <div className="text-xs font-medium">{userName(view, a.answeredBy)}</div>
            <p className="text-[13px] text-zinc-800">{a.answer}</p>
          </div>
        </div>
      ) : canAnswer ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (text.trim()) answerQuestion(a.id, text)
          }}
          className="space-y-2"
        >
          <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} className={inputCls} placeholder="Answer the question…" />
          <div className="flex justify-end">
            <Button type="submit" variant="primary" disabled={!text.trim()}>
              Answer
            </Button>
          </div>
        </form>
      ) : (
        <Empty>Waiting on the deal team.</Empty>
      )}
    </Card>
  )
}

function AttachmentsByStage({ view, a }: { view: View; a: Ask }) {
  const mgmt = view.viewer.isMgmt
  const raw = a.attachments.filter((x) => x.stage === 'raw')
  const final = a.attachments.filter((x) => x.stage === 'final')
  const context = a.attachments.filter((x) => x.stage === 'context')
  return (
    <Card title="Files">
      <div className={clsx('grid gap-4', !mgmt && 'sm:grid-cols-2')}>
        {(mgmt || context.length > 0) && (
          <AttachmentList view={view} title={mgmt ? 'From the deal team' : 'Shared with management'} items={context} empty="Nothing shared." about={a.title} />
        )}
        <AttachmentList view={view} title={mgmt ? 'Your uploads' : 'Raw from management'} items={raw} empty={a.mgmtAssigneeId ? 'Nothing uploaded yet.' : 'Not sent to management.'} about={a.title} />
        {!mgmt && <AttachmentList view={view} title="Final from the deal team" items={final} empty="Not delivered yet." about={a.title} />}
      </div>
    </Card>
  )
}

function AttachmentList({ view, title, items, empty, about }: { view: View; title: string; items: Attachment[]; empty: string; about: string }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium text-zinc-500">{title}</div>
      {items.length ? (
        <div className="space-y-1.5">
          {items.map((f) => (
            <AttachmentRow key={f.id} view={view} file={f} about={about} />
          ))}
        </div>
      ) : (
        <div className="text-xs text-zinc-400">{empty}</div>
      )}
    </div>
  )
}

function FlagModal({ open, onClose, onFlag }: { open: boolean; onClose: () => void; onFlag: (note: string) => void }) {
  const [note, setNote] = useState('')
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Flag to MD"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={!note.trim()}
            onClick={() => {
              onFlag(note)
              setNote('')
              onClose()
            }}
          >
            Flag to MD
          </Button>
        </>
      }
    >
      <p className="mb-2 text-zinc-600">Use this when the call is above the VP. It sits at the top of the MD's dashboard until it is answered.</p>
      <textarea autoFocus rows={3} value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} placeholder="Needs your call: a 3-year volume floor could conflict with add-on volumes." />
    </Modal>
  )
}

/** "Sam Ortiz" on their own; first names when there are several: "Sam and Priya", "Sam, Priya and Alex". */
function names(view: View, ids: string[]) {
  if (ids.length <= 1) return ids.map((id) => userName(view, id)).join('')
  const list = ids.map((id) => userName(view, id).split(' ')[0])
  return `${list.slice(0, -1).join(', ')} and ${list.at(-1)}`
}

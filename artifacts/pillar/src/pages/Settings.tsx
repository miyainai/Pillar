import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { URGENCIES, type Role } from '../lib/types'
import { fmtSize, useView } from '../lib/selectors'
import { fmtDateYear } from '../lib/dates'
import { Avatar, Button, Card, Field, PageHeader, Select, VisibilityToggle, inputCls } from '../components/ui'

const ROLES: Role[] = ['MD', 'Principal', 'VP', 'Associate', 'OP', 'Management']

export default function Settings() {
  const view = useView()
  const s = useStore()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [title, setTitle] = useState('')
  const [role, setRole] = useState<Role>('OP')
  if (!view) return null
  const { company, settings } = view
  const canEdit = view.viewer.canEditPlan
  const others = s.db.users.filter((u) => !view.members.some((m) => m.user.id === u.id))

  return (
    <div className="max-w-4xl">
      <PageHeader title="Settings" subtitle={`${company.name} workspace`} />
      {!canEdit && <p className="mb-4 text-xs text-zinc-500">Only the deal team can change settings.</p>}

      <div className="space-y-4">
        <Card title="Members and roles" pad={false}>
          <div className="divide-y divide-zinc-100">
            {view.members.map((m) => (
              <div key={m.user.id} className="flex items-center gap-3 px-3.5 py-2">
                <Avatar name={m.user.name} size={24} />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium">{m.user.name}</div>
                  <div className="truncate text-[11.5px] text-zinc-500">
                    {m.user.title} · {m.user.email}
                  </div>
                </div>
                <Select<Role> disabled={!canEdit} value={m.role} onChange={(r) => s.setMemberRole(company.id, m.user.id, r)} options={ROLES} className="w-36" />
                <Button
                  variant="ghost"
                  size="xs"
                  disabled={!canEdit || m.user.id === view.viewer.user.id}
                  onClick={() => confirm(`Remove ${m.user.name} from ${company.name}?`) && s.setMemberRole(company.id, m.user.id, null)}
                  aria-label="Remove"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
          {canEdit && (
            <div className="space-y-3 border-t border-zinc-100 px-3.5 py-3">
              {others.length > 0 && (
                <div className="flex flex-wrap items-end gap-2">
                  <Field label="Add someone already at the firm or a portfolio company" className="min-w-[260px] flex-1">
                    <Select
                      value=""
                      onChange={(id) => id && s.setMemberRole(company.id, id, role)}
                      options={[{ value: '', label: 'Choose a person…' }, ...others.map((u) => ({ value: u.id, label: `${u.name} · ${u.title}` }))]}
                    />
                  </Field>
                  <Field label="As" className="w-36">
                    <Select<Role> value={role} onChange={setRole} options={ROLES} />
                  </Field>
                </div>
              )}
              <form
                className="flex flex-wrap items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!name.trim()) return
                  s.addPerson(company.id, name, email, title, role)
                  setName('')
                  setEmail('')
                  setTitle('')
                }}
              >
                <Field label="Or invite someone new" className="min-w-[160px] flex-1">
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className={inputCls} />
                </Field>
                <Field label="Email" className="min-w-[160px] flex-1">
                  <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" className={inputCls} />
                </Field>
                <Field label="Title" className="min-w-[140px] flex-1">
                  <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="VP Operations" className={inputCls} />
                </Field>
                <Field label="Role" className="w-32">
                  <Select<Role> value={role} onChange={setRole} options={ROLES} />
                </Field>
                <Button type="submit" variant="primary" disabled={!name.trim()}>
                  Add
                </Button>
              </form>
            </div>
          )}
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Card title="Default visibility">
            <p className="mb-2 text-[12.5px] text-zinc-500">New pillars start here. Sharing with management should be a deliberate click.</p>
            <VisibilityToggle disabled={!canEdit} value={settings.defaultVisibility} onChange={(v) => s.updateSettings(company.id, { defaultVisibility: v })} />
            <div className="mt-4">
              <Field label="Flag a pillar as stale after (days without an update)">
                <input
                  type="number"
                  min={1}
                  disabled={!canEdit}
                  value={settings.staleDays}
                  onChange={(e) => s.updateSettings(company.id, { staleDays: Math.max(1, Number(e.target.value) || 14) })}
                  className={inputCls + ' w-24'}
                />
              </Field>
            </div>
          </Card>
          <Card title="Urgency time limits">
            <p className="mb-2 text-[12.5px] text-zinc-500">The due date fills in from urgency and stays editable on each ask.</p>
            <div className="grid grid-cols-2 gap-2">
              {URGENCIES.map((u) => (
                <Field key={u} label={`${u} (hours)`}>
                  <input
                    type="number"
                    min={1}
                    disabled={!canEdit}
                    value={settings.urgencyHours[u]}
                    onChange={(e) => s.updateSettings(company.id, { urgencyHours: { ...settings.urgencyHours, [u]: Math.max(1, Number(e.target.value) || 1) } })}
                    className={inputCls}
                  />
                </Field>
              ))}
            </div>
          </Card>
        </div>

        <Card
          title="Deal materials"
          pad={false}
          action={
            <Link to={`/c/${company.id}/files`} className="text-[12.5px] text-accent hover:underline">
              See every file in the Files tab
            </Link>
          }
        >
          <div className="divide-y divide-zinc-100">
            {view.documents.map((d) => (
              <div key={d.id} className="flex items-center gap-3 px-3.5 py-2 text-[13px]">
                <span className="rounded bg-zinc-100 px-1.5 text-[11px] font-medium text-zinc-600">{d.type}</span>
                <span className="flex-1 truncate">{d.name}</span>
                <span className="text-xs text-zinc-400">
                  {fmtSize(d.size)} · {fmtDateYear(d.date)}
                </span>
              </div>
            ))}
            {!view.documents.length && <div className="px-3.5 py-3 text-xs text-zinc-400">No documents uploaded.</div>}
          </div>
        </Card>
      </div>
    </div>
  )
}

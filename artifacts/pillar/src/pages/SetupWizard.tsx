import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { AlertTriangle, Check, FileText, Loader2, Sparkles, Trash2, Upload, X } from 'lucide-react'
import { useStore, type GeneratedPlan } from '../lib/store'
import type { DocType, Role } from '../lib/types'
import { fromInputDate, nowIso, toInputDate } from '../lib/dates'
import { demoFile, extractText, type ExtractedDoc } from '../lib/extract'
import { generatePlan, GENERATE_TIMEOUT_MS, type GenerateResult, type Person } from '../lib/ai'
import { fmtSize } from '../lib/selectors'
import { Avatar, Button, Card, Field, PageHeader, Segmented, Select, VisibilityBadge, inputCls } from '../components/ui'

const STEPS = ['Company basics', 'People and roles', 'Upload materials', 'Plan settings', 'Generate']
const LEVERS = ['Pricing', 'Procurement', 'Sales effectiveness', 'Operations and footprint', 'Working capital', 'Add-on M&A', 'Talent and leadership', 'Technology']
const DOC_TYPES: DocType[] = ['IC deck', 'Model', 'CIM', 'QoE', 'Diligence report', 'Other']
const ROLES: Role[] = ['MD', 'Principal', 'VP', 'Associate', 'OP', 'Management']
const MAX_CHARS = 180_000

interface PersonRow {
  key: string
  userId?: string
  name: string
  title: string
  email?: string
  role: Role
}

export default function SetupWizard() {
  const db = useStore((s) => s.db)
  const userId = useStore((s) => s.userId)
  const createCompany = useStore((s) => s.createCompany)
  const navigate = useNavigate()
  const me = db.users.find((u) => u.id === userId)!

  const [step, setStep] = useState(0)
  const [basics, setBasics] = useState({ name: '', sector: '', closeDate: toInputDate(nowIso()), holdYears: 5, entryEbitda: 0, exitEbitda: 0 })
  const [people, setPeople] = useState<PersonRow[]>([{ key: me.id, userId: me.id, name: me.name, title: me.title, role: 'VP' }])
  const [docs, setDocs] = useState<ExtractedDoc[]>([])
  const [reading, setReading] = useState(false)
  const [settings, setSettings] = useState({ pillarCount: 5, detail: 'Standard', levers: [] as string[] })
  const [gen, setGen] = useState<null | GenerateResult>(null)
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const abort = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!running) return
    const start = Date.now()
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 250)
    return () => clearInterval(t)
  }, [running])

  const firmUsers = db.users.filter((u) => db.memberships.some((m) => m.userId === u.id && m.role !== 'Management'))

  const fillDemo = async () => {
    setBasics({ name: 'Fernhill Foods (Day 0)', sector: 'Specialty snacks', closeDate: toInputDate(nowIso()), holdYears: 5, entryEbitda: 40, exitEbitda: 65 })
    const roles: [string, Role][] = [
      ['u-alex', 'MD'],
      ['u-priya', 'VP'],
      ['u-sam', 'Associate'],
      ['u-jordan', 'OP'],
      ['u-casey', 'OP'],
      ['u-morgan', 'OP'],
    ]
    setPeople(
      roles.map(([id, role]) => {
        const u = db.users.find((x) => x.id === id)!
        return { key: id, userId: id, name: u.name, title: u.title, role }
      }),
    )
    setSettings({ pillarCount: 6, detail: 'Standard', levers: ['Procurement', 'Pricing', 'Sales effectiveness', 'Operations and footprint', 'Add-on M&A'] })
    setReading(true)
    const files = await Promise.all([
      demoFile('/demo/Fernhill_IC_Memo.pdf', 'Fernhill IC Memo.pdf', 'application/pdf'),
      demoFile('/demo/Fernhill_Model_Summary.xlsx', 'Fernhill Model Summary.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
    ])
    setDocs(await Promise.all(files.map(extractText)))
    setReading(false)
  }

  const addFiles = async (files: File[]) => {
    setReading(true)
    const out = await Promise.all(files.map(extractText))
    setDocs((d) => [...d, ...out])
    setReading(false)
  }

  const totalChars = docs.reduce((a, d) => a + d.text.length, 0)
  const valid = [
    !!basics.name.trim() && basics.exitEbitda > basics.entryEbitda && basics.entryEbitda > 0,
    people.some((p) => p.role !== 'Management'),
    true,
    true,
    !!gen,
  ]

  const personList = (): Person[] =>
    people.filter((p) => p.role !== 'Management').map((p) => ({ id: p.userId ?? p.key, name: p.name, role: p.role, title: p.title }))

  const run = async () => {
    setRunning(true)
    setGen(null)
    setElapsed(0)
    abort.current = new AbortController()
    // Text over the limit is cut, and the review screen says so.
    let budget = MAX_CHARS
    const documents = docs
      .filter((d) => d.text)
      .map((d) => {
        const text = d.text.slice(0, Math.max(0, budget))
        budget -= text.length
        return { name: d.name, type: d.type, text }
      })
    const result = await generatePlan(
      {
        company: { ...basics, closeDate: fromInputDate(basics.closeDate) },
        settings,
        people: personList(),
        documents,
      },
      abort.current.signal,
    )
    setGen(result)
    setRunning(false)
  }

  const finish = () => {
    if (!gen) return
    // Owners from the generated plan point at people ids; new people get real ids on create.
    const id = createCompany({
      ...basics,
      closeDate: fromInputDate(basics.closeDate),
      people: people.map((p) => ({ userId: p.userId, name: p.userId ? undefined : p.name, title: p.title, email: p.email, role: p.role })),
      documents: docs.map((d) => ({ name: d.name, size: d.size, type: d.type })),
      plan: gen.plan,
      aiNote: gen.source === 'ai' ? 'Draft generated by AI from the uploaded deal materials.' : 'Draft loaded from the pre-generated demo plan.',
    })
    navigate(`/c/${id}/plan`)
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Set up a new company"
        subtitle="Day 0: upload the IC memo and model, and Pillar drafts the value creation plan."
        actions={
          <Button variant="ghost" onClick={fillDemo} icon={<Sparkles className="size-3.5 text-accent" />}>
            Fill with demo files
          </Button>
        }
      />
      <ol className="mb-5 flex flex-wrap gap-1.5">
        {STEPS.map((label, i) => (
          <li key={label}>
            <button
              onClick={() => i <= step && setStep(i)}
              className={clsx(
                'flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12.5px] font-medium',
                i === step ? 'bg-zinc-900 text-white' : i < step ? 'bg-green-50 text-green-800' : 'bg-zinc-100 text-zinc-500',
              )}
            >
              {i < step ? <Check className="size-3.5" /> : <span className="tabular">{i + 1}</span>} {label}
            </button>
          </li>
        ))}
      </ol>

      <Card>
        {step === 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Company name" className="sm:col-span-2">
              <input value={basics.name} onChange={(e) => setBasics({ ...basics, name: e.target.value })} className={inputCls} placeholder="Fernhill Foods" />
            </Field>
            <Field label="Sector">
              <input value={basics.sector} onChange={(e) => setBasics({ ...basics, sector: e.target.value })} className={inputCls} placeholder="Specialty snacks" />
            </Field>
            <Field label="Close date">
              <input type="date" value={basics.closeDate} onChange={(e) => setBasics({ ...basics, closeDate: e.target.value })} className={inputCls} />
            </Field>
            <Field label="Entry EBITDA ($M)">
              <input type="number" value={basics.entryEbitda || ''} onChange={(e) => setBasics({ ...basics, entryEbitda: Number(e.target.value) })} className={inputCls} />
            </Field>
            <Field label="Underwritten exit EBITDA ($M)">
              <input type="number" value={basics.exitEbitda || ''} onChange={(e) => setBasics({ ...basics, exitEbitda: Number(e.target.value) })} className={inputCls} />
            </Field>
            <Field label="Target hold (years)">
              <input type="number" min={1} max={10} value={basics.holdYears} onChange={(e) => setBasics({ ...basics, holdYears: Number(e.target.value) })} className={inputCls} />
            </Field>
            {basics.exitEbitda > basics.entryEbitda && (
              <div className="self-end pb-2 text-[12.5px] text-zinc-500">
                Gap the plan needs to cover: <span className="tabular font-semibold text-zinc-800">${(basics.exitEbitda - basics.entryEbitda).toFixed(1)}M</span>
              </div>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <p className="text-[12.5px] text-zinc-500">Add the deal team and operating partners. Management can be invited now or after alignment; they only ever see shared pillars.</p>
            <div className="divide-y divide-zinc-100 rounded-md border border-zinc-200">
              {people.map((p, i) => (
                <div key={p.key} className="flex items-center gap-3 px-3 py-2">
                  <Avatar name={p.name} size={24} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium">{p.name}</div>
                    <div className="truncate text-[11.5px] text-zinc-500">{p.title}</div>
                  </div>
                  <Select<Role> value={p.role} onChange={(r) => setPeople(people.map((x, j) => (j === i ? { ...x, role: r } : x)))} options={ROLES} className="w-36" />
                  <button onClick={() => setPeople(people.filter((_, j) => j !== i))} className="text-zinc-400 hover:text-red-500" aria-label="Remove">
                    <X className="size-4" />
                  </button>
                </div>
              ))}
            </div>
            <AddPerson
              firmUsers={firmUsers.filter((u) => !people.some((p) => p.userId === u.id))}
              onAdd={(row) => setPeople([...people, row])}
            />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <p className="text-[12.5px] text-zinc-500">PDF, Excel, or CSV. Export decks to PDF first. Text is pulled out in your browser, with page numbers so the plan can cite its sources.</p>
            <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-zinc-300 px-4 py-8 text-zinc-500 hover:border-zinc-400 hover:text-zinc-800">
              <Upload className="size-5" />
              <span className="text-[13px] font-medium">Choose files</span>
              <span className="text-[11.5px] text-zinc-400">IC memo, model, CIM, QoE, diligence reports</span>
              <input type="file" multiple accept=".pdf,.xlsx,.xls,.csv,.txt,.md" className="hidden" onChange={(e) => e.target.files && addFiles(Array.from(e.target.files)).then(() => (e.target.value = ''))} />
            </label>
            {reading && (
              <div className="flex items-center gap-2 text-[12.5px] text-zinc-500">
                <Loader2 className="size-3.5 animate-spin" /> Reading files…
              </div>
            )}
            <div className="space-y-1.5">
              {docs.map((d, i) => (
                <div key={i} className="flex items-center gap-3 rounded-md border border-zinc-200 px-3 py-2">
                  <FileText className="size-4 text-zinc-400" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium">{d.name}</div>
                    <div className={clsx('text-[11.5px]', d.error ? 'text-red-600' : 'text-zinc-500')}>
                      {d.error ?? `${fmtSize(d.size)} · ${d.pages ? `${d.pages} pages · ` : ''}${d.text.length.toLocaleString()} characters extracted`}
                    </div>
                  </div>
                  <Select<DocType> value={d.type} onChange={(t) => setDocs(docs.map((x, j) => (j === i ? { ...x, type: t } : x)))} options={DOC_TYPES} className="w-40" />
                  <button onClick={() => setDocs(docs.filter((_, j) => j !== i))} className="text-zinc-400 hover:text-red-500" aria-label="Remove">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
            {totalChars > MAX_CHARS && (
              <p className="flex items-center gap-1.5 text-[12.5px] text-amber-700">
                <AlertTriangle className="size-3.5" /> Materials total {totalChars.toLocaleString()} characters; only the first {MAX_CHARS.toLocaleString()} will be sent.
              </p>
            )}
            <p className="text-[11.5px] text-zinc-400">Use fictional data only for the hackathon. Never upload real deal materials.</p>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <Field label={`Number of pillars: ${settings.pillarCount}`} hint="Default 5, range 3 to 8. Past about 7 a VCP stops being a priority list.">
              <input type="range" min={3} max={8} value={settings.pillarCount} onChange={(e) => setSettings({ ...settings, pillarCount: Number(e.target.value) })} className="w-64 accent-[var(--color-accent)]" />
            </Field>
            <Field label="Detail level">
              <Segmented
                value={settings.detail}
                onChange={(d) => setSettings({ ...settings, detail: d })}
                options={[
                  { value: 'Light', label: 'Light' },
                  { value: 'Standard', label: 'Standard' },
                  { value: 'Detailed', label: 'Detailed' },
                ]}
              />
              <span className="mt-1 block text-[11.5px] text-zinc-400">
                {settings.detail === 'Light' && '2 sub-pillars per pillar, 2 phases each.'}
                {settings.detail === 'Standard' && '2 to 3 sub-pillars, 3 phases each, plus KPIs.'}
                {settings.detail === 'Detailed' && 'Up to 4 sub-pillars, 4 phases each, plus KPIs, owners, and deliverables.'}
              </span>
            </Field>
            <Field label="Focus levers (optional)">
              <div className="flex flex-wrap gap-1.5">
                {LEVERS.map((l) => {
                  const on = settings.levers.includes(l)
                  return (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setSettings({ ...settings, levers: on ? settings.levers.filter((x) => x !== l) : [...settings.levers, l] })}
                      className={clsx('h-7 rounded-full border px-2.5 text-[12.5px]', on ? 'border-accent bg-accent-soft text-accent' : 'border-zinc-200 text-zinc-600 hover:border-zinc-300')}
                    >
                      {l}
                    </button>
                  )
                })}
              </div>
            </Field>
          </div>
        )}

        {step === 4 && (
          <div>
            {!running && !gen && (
              <div className="py-6 text-center">
                <Sparkles className="mx-auto size-6 text-accent" />
                <p className="mt-2 text-[13px] text-zinc-600">
                  Draft {settings.pillarCount} pillars at {settings.detail.toLowerCase()} detail from {docs.filter((d) => d.text).length} documents.
                </p>
                <p className="text-[11.5px] text-zinc-400">If AI isn't set up, fails, or takes over {GENERATE_TIMEOUT_MS / 1000} seconds, the pre-generated demo plan loads instead.</p>
                <Button variant="primary" size="md" className="mt-4" onClick={run} icon={<Sparkles className="size-3.5" />}>
                  Generate draft plan
                </Button>
              </div>
            )}
            {running && (
              <div className="py-8 text-center">
                <Loader2 className="mx-auto size-6 animate-spin text-accent" />
                <p className="mt-3 text-[13px] font-medium">
                  {elapsed < 4 ? 'Reading the IC memo and model…' : elapsed < 12 ? 'Mapping the EBITDA bridge to pillars…' : elapsed < 25 ? 'Drafting sub-pillars, phases, and KPIs…' : 'Checking targets add up…'}
                </p>
                <p className="tabular text-[11.5px] text-zinc-400">{elapsed}s</p>
                <Button variant="ghost" size="sm" className="mt-3" onClick={() => abort.current?.abort()}>
                  Use the pre-generated plan instead
                </Button>
              </div>
            )}
            {gen && <Review gen={gen} people={personList()} gap={basics.exitEbitda - basics.entryEbitda} onRetry={run} />}
          </div>
        )}
      </Card>

      <div className="mt-4 flex items-center justify-between">
        <Button variant="ghost" disabled={step === 0 || running} onClick={() => setStep(step - 1)}>
          Back
        </Button>
        <div className="flex items-center gap-3">
          {step === 4 && (
            <Link to="/c/c-fernhill" className="text-[12.5px] text-zinc-500 hover:text-zinc-800">
              Skip to Fernhill, four months later →
            </Link>
          )}
          {step < 4 ? (
            <Button variant="primary" disabled={!valid[step] || reading} onClick={() => setStep(step + 1)}>
              Continue
            </Button>
          ) : (
            <Button variant="primary" disabled={!gen} onClick={finish}>
              Create workspace and open draft
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function AddPerson({ firmUsers, onAdd }: { firmUsers: { id: string; name: string; title: string }[]; onAdd: (p: PersonRow) => void }) {
  const [pick, setPick] = useState('')
  const [role, setRole] = useState<Role>('OP')
  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  return (
    <div className="space-y-2 rounded-md bg-zinc-50 p-3">
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Add from the firm" className="min-w-[220px] flex-1">
          <Select value={pick} onChange={setPick} options={[{ value: '', label: 'Choose…' }, ...firmUsers.map((u) => ({ value: u.id, label: `${u.name} · ${u.title}` }))]} />
        </Field>
        <Field label="Role" className="w-36">
          <Select<Role> value={role} onChange={setRole} options={ROLES} />
        </Field>
        <Button
          disabled={!pick}
          onClick={() => {
            const u = firmUsers.find((x) => x.id === pick)!
            onAdd({ key: u.id, userId: u.id, name: u.name, title: u.title, role })
            setPick('')
          }}
        >
          Add
        </Button>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Or someone new (e.g. the CEO or CFO)" className="min-w-[160px] flex-1">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className={inputCls} />
        </Field>
        <Field label="Title" className="min-w-[140px] flex-1">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="CFO" className={inputCls} />
        </Field>
        <Button
          disabled={!name.trim()}
          onClick={() => {
            onAdd({ key: `new-${Date.now()}`, name: name.trim(), title: title.trim(), role })
            setName('')
            setTitle('')
          }}
        >
          Add
        </Button>
      </div>
    </div>
  )
}

function Review({ gen, people, gap, onRetry }: { gen: GenerateResult; people: Person[]; gap: number; onRetry: () => void }) {
  const total = gen.plan.pillars.reduce((a, p) => a + p.targetImpact, 0)
  const off = Math.abs(total - gap) > Math.max(0.5, gap * 0.05)
  const name = (id: string) => people.find((p) => p.id === id)?.name ?? ''
  return (
    <div className="space-y-3">
      {gen.source === 'ai' ? (
        <div className="flex items-center gap-2 rounded-md bg-green-50 px-3 py-2 text-[12.5px] text-green-800">
          <Sparkles className="size-3.5" /> Drafted by AI from your materials. Every pillar cites its source; check them before you share anything.
        </div>
      ) : gen.failure === 'not_configured' ? (
        // Expected state without an API key: say what loaded, without a warning.
        <div className="flex items-center gap-2 rounded-md bg-zinc-50 px-3 py-2 text-[12.5px] text-zinc-700">
          <FileText className="size-3.5 text-zinc-500" /> Loaded the pre-built Fernhill draft (built from the Fernhill IC memo). Every pillar cites its source; check them before you share anything.
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-[12.5px] text-amber-800">
          <AlertTriangle className="size-3.5" /> Loaded the pre-generated demo plan (built from the Fernhill IC memo). Reason: {gen.reason}
          <Button size="xs" className="ml-auto" onClick={onRetry}>
            Try AI again
          </Button>
        </div>
      )}
      {gen.warnings.map((w) => (
        <div key={w} className="rounded-md bg-amber-50 px-3 py-1.5 text-[12px] text-amber-800">
          {w}
        </div>
      ))}
      <div className={clsx('text-[12.5px]', off ? 'text-amber-700' : 'text-zinc-500')}>
        Pillar targets sum to <span className="tabular font-semibold">${total.toFixed(1)}M</span> against a ${gap.toFixed(1)}M gap{off ? '. Adjust in the builder.' : '.'}
      </div>
      <div className="divide-y divide-zinc-100 rounded-md border border-zinc-200">
        {gen.plan.pillars.map((p, i) => (
          <div key={i} className="px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold">
                {i + 1}. {p.name}
              </span>
              <VisibilityBadge visibility={p.visibility} />
              <span className="tabular ml-auto text-[12.5px] font-medium">${p.targetImpact.toFixed(1)}M</span>
            </div>
            <div className="text-[12px] text-zinc-600">{p.objective}</div>
            <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11.5px] text-zinc-500">
              {p.sourceRef && (
                <span className="inline-flex items-center gap-1">
                  <FileText className="size-3" /> {p.sourceRef}
                </span>
              )}
              {p.ownerIds.length > 0 && <span>Owner: {p.ownerIds.map(name).join(', ')}</span>}
              <span>
                {p.subPillars.length ? `${p.subPillars.length} sub-pillars: ${p.subPillars.map((s) => `${s.name} ($${s.targetImpact.toFixed(1)}M${s.visibility === 'firm' ? ', Firm only' : ''})`).join(', ')}` : `${p.phases.length} phases`}
              </span>
            </div>
          </div>
        ))}
      </div>
      <p className="text-[11.5px] text-zinc-400">The plan stays labeled Draft until alignment sign-off locks VCP v1.</p>
    </div>
  )
}

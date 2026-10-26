import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { AlertTriangle } from 'lucide-react'
import { useStore } from '../lib/store'
import { onPlan, type View } from '../lib/permissions'
import { isAskOpen, isOverdue, isPlanLocked, isStale, lastUpdateBy, latestVersion, ownedBy, planTotals, sortAsks, useView, userName } from '../lib/selectors'
import { daysSince, monthsSince, relTime } from '../lib/dates'
import { AskStatusPill, Avatar, Button, Card, CompanyLogo, Empty, FilePicker, PageHeader, ProgressBar, Stat, StatusDot, StatusPill, UrgencyBadge } from '../components/ui'
import { buildDashboardBridge } from '../lib/bridge'
import { DashboardBridge } from '../components/DashboardBridge'
import { PillarGrid } from '../components/PillarGrid'
import { PostUpdateForm } from '../components/PostUpdate'
import { UpdateItem } from '../components/Feed'
import { CourtCard } from '../components/Court'
import { PhaseTimeline } from '../components/PhaseTimeline'

/**
 * One dashboard per role, all built on the same idea: the top of the page is what is in your
 * court, the rest is the state of the plan at a glance.
 */
export default function Dashboard() {
  const userId = useStore((s) => s.userId)
  const companyId = useStore((s) => s.companyId)
  return <DashboardFor key={`${userId}:${companyId}`} />
}

function DashboardFor() {
  const view = useView()
  if (!view) return null
  const role = view.viewer.role
  return (
    <div>
      <Header view={view} />
      {(role === 'MD' || role === 'Principal') && <MdDashboard view={view} />}
      {role === 'OP' && <OpDashboard view={view} />}
      {(role === 'VP' || role === 'Associate') && <DealTeamDashboard view={view} />}
      {role === 'Management' && <MgmtDashboard view={view} />}
    </div>
  )
}

function Header({ view }: { view: View }) {
  const { company, viewer } = view
  const totals = planTotals(view)
  const version = latestVersion(view)
  const locked = isPlanLocked(view)
  const months = monthsSince(company.closeDate)
  const bridge = buildDashboardBridge(view)
  const mismatch = viewer.isFirm && Math.abs(bridge.target - company.exitEbitda) > Math.max(0.5, totals.gap * 0.1)
  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-2.5">
            <CompanyLogo company={company} size={34} /> {company.name}
          </span>
        }
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2">
            <span>{company.sector}</span>·<span>Month {months + 1} of a {company.holdYears}-year hold</span>·
            <span>
              {version ? `VCP v${version.version}` : 'No plan yet'}{' '}
              {version && (locked ? <span className="text-zinc-400">locked</span> : <span className="font-medium text-amber-700">draft</span>)}
            </span>
            · <span>Viewing as {viewer.user.name} ({viewer.role})</span>
          </span>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Entry EBITDA" value={`$${company.entryEbitda.toFixed(1)}M`} sub="At close" />
        <Stat
          label={viewer.isMgmt ? 'Shared pillar target' : 'Pillar target impact'}
          value={`+$${totals.target.toFixed(1)}M`}
          sub={
            viewer.isMgmt ? (
              'Run-rate, across shared pillars'
            ) : mismatch ? (
              <span className="inline-flex items-center gap-1 text-amber-700">
                <AlertTriangle className="size-3" /> Bridge incl. organic: ${bridge.target.toFixed(1)}M vs IC ${company.exitEbitda.toFixed(1)}M
              </span>
            ) : (
              `With organic, bridge target is $${bridge.target.toFixed(1)}M`
            )
          }
        />
        <Stat
          label="Pillar captured to date"
          value={`$${totals.captured.toFixed(1)}M`}
          tone={onPlan(totals.captured, totals.planToDate) ? 'good' : 'bad'}
          sub={
            onPlan(totals.captured, totals.planToDate)
              ? `${Math.round(totals.pct * 100)}% of target · on plan ($${totals.planToDate.toFixed(1)}M due by now)`
              : `${Math.round(totals.pct * 100)}% of target · $${(totals.planToDate - totals.captured).toFixed(1)}M behind plan`
          }
        />
        <Stat label={viewer.isMgmt ? 'Target EBITDA' : 'Underwritten exit EBITDA'} value={`$${(viewer.isMgmt ? bridge.target : company.exitEbitda).toFixed(1)}M`} sub={`Year ${company.holdYears}`} />
      </div>
    </>
  )
}

// ---------------------------------------------------------------- MD / Principal

function MdDashboard({ view }: { view: View }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-5">
        <CourtCard view={view} className="lg:col-span-2" />
        <DashboardBridge view={view} className="lg:col-span-3 min-w-0" />
      </div>
      <Card title="Pillar health">
        <PillarGrid view={view} />
      </Card>
      <Card title="Who is working on what" pad={false}>
        <WhoIsWorking view={view} />
      </Card>
    </div>
  )
}

function WhoIsWorking({ view }: { view: View }) {
  const people = view.members.filter((m) => m.role !== 'Management' && (m.role === 'OP' || ownedBy(view, m.user.id).pillars.length > 0))
  return (
    <div className="divide-y divide-zinc-100">
      {people.map((m) => {
        const { pillars, subs } = ownedBy(view, m.user.id)
        const last = lastUpdateBy(view, m.user.id)
        const asks = view.asks.filter((a) => isAskOpen(a) && (a.createdBy === m.user.id || a.assigneeIds.includes(m.user.id)))
        const items = subs.length ? subs.map((s) => ({ id: s.pillarId, name: s.name, status: s.status })) : pillars.map((p) => ({ id: p.id, name: p.name, status: p.status }))
        const quiet = !last || daysSince(last.createdAt) > (view.settings.staleDays ?? 14)
        return (
          <div key={m.user.id} className="grid gap-2 px-3.5 py-2.5 sm:grid-cols-[180px_1fr]">
            <div className="flex items-center gap-2">
              <Avatar name={m.user.name} size={26} />
              <div className="min-w-0 leading-tight">
                <div className="truncate text-[13px] font-medium">{m.user.name}</div>
                <div className="truncate text-[11.5px] text-zinc-500">
                  {m.role} · {asks.length} open {asks.length === 1 ? 'ask' : 'asks'}
                </div>
              </div>
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap gap-1.5">
                {items.map((it) => (
                  <Link key={it.name} to={`/c/${view.company.id}/pillars/${it.id}`} className="inline-flex h-5 items-center gap-1.5 rounded bg-zinc-100 px-1.5 text-[11.5px] hover:bg-zinc-200">
                    <StatusDot status={it.status} className="size-1.5" />
                    {it.name}
                  </Link>
                ))}
                {!items.length && <span className="text-xs text-zinc-400">No pillars assigned</span>}
              </div>
              <div className={clsx('mt-1 truncate text-xs', quiet ? 'text-amber-700' : 'text-zinc-500')}>
                {last ? (
                  <>
                    Last update {relTime(last.createdAt)}: <span className={quiet ? '' : 'text-zinc-700'}>{last.text}</span>
                  </>
                ) : (
                  'No updates yet'
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------- OP

function OpDashboard({ view }: { view: View }) {
  const me = view.viewer.user.id
  const confirmNoChange = useStore((s) => s.confirmNoChange)
  const { pillars, subs } = ownedBy(view, me)
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-5">
        <CourtCard view={view} className="lg:col-span-2" />
        <Card className="lg:col-span-3" title="Post update">
          <PostUpdateForm view={view} compact />
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3" title="My pillars" pad={false}>
          {!pillars.length && <Empty>You have no pillars assigned in this company.</Empty>}
          <div className="divide-y divide-zinc-100">
            {pillars.map((p) => {
              const mySubs = subs.filter((s) => s.pillarId === p.id)
              const stale = isStale(view, p)
              return (
                <div key={p.id} className="px-3.5 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to={`/c/${view.company.id}/pillars/${p.id}`} className="min-w-0 flex-1 truncate text-[13px] font-semibold hover:underline">
                      {p.num}. {p.name}
                    </Link>
                    <StatusPill status={p.status} />
                    <span className={clsx('text-right text-xs sm:w-28', stale ? 'font-medium text-amber-700' : 'text-zinc-500')}>
                      {daysSince(p.lastUpdated)} days since update
                    </span>
                  </div>
                  {stale && (
                    <div className="mt-2 flex items-center gap-2 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
                      <AlertTriangle className="size-3.5" /> No update in {daysSince(p.lastUpdated)} days.
                      <Button size="xs" className="ml-auto" onClick={() => confirmNoChange(p.id)}>
                        Confirm no change
                      </Button>
                    </div>
                  )}
                  <div className="mt-2 space-y-2">
                    {(mySubs.length ? mySubs : []).map((s) => (
                      <div key={s.id} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 rounded-md border border-zinc-100 px-2.5 py-2 sm:grid-cols-[minmax(0,1fr)_140px_160px]">
                        <div className="min-w-0 truncate text-[12.5px]">
                          <span className="text-zinc-400">{s.num}</span> {s.name}
                        </div>
                        <div className="text-right sm:text-left">
                          <StatusPill status={s.status} />
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                          <div className="tabular text-right text-[11.5px] text-zinc-600">
                            ${s.capturedImpact.toFixed(1)}M / ${s.targetImpact.toFixed(1)}M
                          </div>
                          <ProgressBar value={s.capturedImpact} max={s.targetImpact} className="mt-1" />
                        </div>
                      </div>
                    ))}
                    {!mySubs.length && (
                      <div className="flex items-center gap-3 text-xs text-zinc-600">
                        <span className="tabular">
                          ${p.captured.toFixed(1)}M / ${p.target.toFixed(1)}M
                        </span>
                        <ProgressBar value={p.captured} max={p.target} className="flex-1" />
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
        <Card className="lg:col-span-2" title="Recent updates" pad={false}>
          <div className="divide-y divide-zinc-50 px-3.5">
            {view.updates.slice(0, 6).map((u) => (
              <UpdateItem key={u.id} view={view} u={u} />
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- VP / Associate

function DealTeamDashboard({ view }: { view: View }) {
  return (
    <div className="space-y-4">
      <CourtCard view={view} />
      <DashboardBridge view={view} />
      <Card title="Pillar health">
        <PillarGrid view={view} />
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------- Management

function MgmtDashboard({ view }: { view: View }) {
  const uploadToAsk = useStore((s) => s.uploadToAsk)
  const showToast = useStore((s) => s.showToast)
  const me = view.viewer.user.id
  const requests = sortAsks(view.asks.filter((a) => a.mgmtAssigneeId === me || a.status === 'Sent to management'))
  const waiting = requests.filter((a) => a.status === 'Sent to management')
  const done = requests.filter((a) => a.status !== 'Sent to management')
  return (
    <div className="space-y-4">
      <Card
        pad={false}
        title={
          <>
            In your court {waiting.length > 0 && <span className="rounded bg-violet-50 px-1.5 text-xs text-violet-700">{waiting.length} waiting</span>}
          </>
        }
      >
        {!waiting.length && <Empty>No requests waiting on you.</Empty>}
        <div className="divide-y divide-zinc-100">
          {waiting.map((a) => (
            <div key={a.id} className={clsx('flex flex-wrap items-center gap-3 px-3.5 py-3', isOverdue(a) && 'bg-red-50/50')}>
              <div className="min-w-0 flex-1">
                <Link to={`/c/${view.company.id}/asks/${a.id}`} className="text-[13px] font-medium hover:underline">
                  {a.title}
                </Link>
                <p className="text-xs text-zinc-600">{a.description}</p>
                <p className="mt-0.5 text-[11.5px] text-zinc-400">
                  From {userName(view, a.createdBy)} ·{' '}
                  <span className={isOverdue(a) ? 'font-medium text-red-600' : ''}>{isOverdue(a) ? 'Overdue' : `Due ${new Date(a.dueDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`}</span>
                </p>
              </div>
              <UrgencyBadge urgency={a.urgency} />
              <FilePicker
                variant="primary"
                onFiles={(files) => {
                  uploadToAsk(a.id, files, 'raw')
                  showToast(`Uploaded ${files.length} file${files.length > 1 ? 's' : ''} to the deal team`)
                }}
              >
                Upload file
              </FilePicker>
            </div>
          ))}
        </div>
        {done.length > 0 && (
          <div className="border-t border-zinc-100">
            <div className="px-3.5 pt-2.5 text-[11.5px] font-medium text-zinc-400 uppercase">Recently completed</div>
            {done.slice(0, 5).map((a) => (
              <Link key={a.id} to={`/c/${view.company.id}/asks/${a.id}`} className="flex items-center gap-3 px-3.5 py-2 text-[13px] hover:bg-zinc-50">
                <span className="flex-1 truncate">{a.title}</span>
                <AskStatusPill status={a.status} mgmt />
              </Link>
            ))}
          </div>
        )}
      </Card>

      <DashboardBridge view={view} />
      <Card title="Shared plan" pad={false}>
        <div className="divide-y divide-zinc-100">
          {view.pillars.map((p) => {
            const subs = view.subPillars.filter((s) => s.pillarId === p.id)
            return (
              <div key={p.id} className="px-3.5 py-3">
                <div className="flex items-center gap-2">
                  <Link to={`/c/${view.company.id}/pillars/${p.id}`} className="flex-1 text-[13px] font-semibold hover:underline">
                    {p.num}. {p.name}
                  </Link>
                  <span className="tabular text-xs text-zinc-600">
                    ${p.captured.toFixed(1)}M of ${p.target.toFixed(1)}M
                  </span>
                  <StatusPill status={p.status} />
                </div>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  {subs.map((s) => (
                    <div key={s.id} className="rounded-md border border-zinc-100 px-2.5 py-2">
                      <div className="flex items-center justify-between gap-2 text-[12.5px]">
                        <span className="truncate">
                          <span className="text-zinc-400">{s.num}</span> {s.name}
                        </span>
                        <span className="tabular text-[11.5px] text-zinc-500">${s.targetImpact.toFixed(1)}M</span>
                      </div>
                      <PhaseTimeline phases={view.phases.filter((ph) => ph.subPillarId === s.id)} labels={false} className="mt-1" />
                    </div>
                  ))}
                  {!subs.length && <PhaseTimeline phases={view.phases.filter((ph) => ph.pillarId === p.id && !ph.subPillarId)} />}
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      <Card title="Recent updates" pad={false}>
        <div className="divide-y divide-zinc-50 px-3.5">
          {view.updates.slice(0, 6).map((u) => (
            <UpdateItem key={u.id} view={view} u={u} />
          ))}
          {!view.updates.length && <Empty>No shared updates yet.</Empty>}
        </div>
      </Card>
    </div>
  )
}

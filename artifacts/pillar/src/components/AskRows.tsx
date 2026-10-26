import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { Flag, HelpCircle, Database } from 'lucide-react'
import type { View } from '../lib/permissions'
import type { Ask } from '../lib/types'
import { isOverdue, userName } from '../lib/selectors'
import { fmtDate, relTime } from '../lib/dates'
import { AskStatusPill, AvatarStack, Empty, UrgencyBadge } from './ui'

export function AskRows({ view, asks, empty = 'Nothing here.' }: { view: View; asks: Ask[]; empty?: string }) {
  if (!asks.length) return <Empty>{empty}</Empty>
  const mgmt = view.viewer.isMgmt
  return (
    <div className="divide-y divide-zinc-100">
      {asks.map((a) => {
        const overdue = isOverdue(a)
        const pillar = view.pillars.find((p) => p.id === a.pillarId)
        return (
          <Link key={a.id} to={`/c/${view.company.id}/asks/${a.id}`} className={clsx('flex items-start gap-3 px-3.5 py-2.5 hover:bg-zinc-50', overdue && 'bg-red-50/50')}>
            {a.type === 'question' ? <HelpCircle className="mt-0.5 size-3.5 shrink-0 text-zinc-400" /> : <Database className="mt-0.5 size-3.5 shrink-0 text-zinc-400" />}
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-1.5 text-[13px] leading-snug font-medium text-zinc-800">
                {a.flaggedToMd && !a.flagResolvedAt && !mgmt && <Flag className="mt-0.5 size-3 shrink-0 text-red-600" />}
                <span className="line-clamp-2">{a.title}</span>
              </div>
              <div className="mt-0.5 truncate text-[11.5px] text-zinc-500">
                {pillar ? `${pillar.num}. ${pillar.name}` : mgmt ? 'Data request' : 'No pillar'} · opened {relTime(a.createdAt)}
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <div className="flex items-center gap-1.5">
                <UrgencyBadge urgency={a.urgency} />
                <AskStatusPill status={a.status} mgmt={mgmt} />
                {!mgmt && <AvatarStack names={a.assigneeIds.map((id) => userName(view, id))} size={20} />}
              </div>
              <span className={clsx('tabular text-[11.5px]', overdue ? 'font-semibold text-red-600' : 'text-zinc-500')}>
                {overdue ? `Overdue · was due ${fmtDate(a.dueDate)}` : `Due ${fmtDate(a.dueDate)}`}
              </span>
            </div>
          </Link>
        )
      })}
    </div>
  )
}

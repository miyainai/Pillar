import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import { ArrowRight, CheckCheck, Clock, Flag, Inbox } from 'lucide-react'
import { scopeFor, type Member, type View } from '../lib/permissions'
import { useStore } from '../lib/store'
import { groupTodos, todosFor, type Todo } from '../lib/todos'
import { fmtDate } from '../lib/dates'
import { Avatar } from './ui'

const SHOW = 6
const ROLE_ORDER = ['MD', 'Principal', 'VP', 'Associate', 'OP', 'Management']
const firstName = (name: string) => name.split(' ')[0]

type Row = { person: Member; todo: Todo }

/**
 * "In your court": the dashboard's to-do list. Opens on the viewer's own list, grouped by how
 * urgent each item is. Firm members can switch to anyone else's court, or see everyone's at once;
 * management only ever sees their own.
 */
export function CourtCard({ view, className }: { view: View; className?: string }) {
  const db = useStore((s) => s.db)
  const resolveFlag = useStore((s) => s.resolveFlag)
  const me = view.viewer.user.id
  const [selected, setSelected] = useState<string>(me)
  const [all, setAll] = useState(false)

  // One list per person, built from that person's own view so visibility rules hold.
  const courts = useMemo(() => {
    const people = view.viewer.isMgmt
      ? view.members.filter((m) => m.user.id === me)
      : [...view.members].sort((a, b) => (a.user.id === me ? -1 : b.user.id === me ? 1 : ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || a.user.name.localeCompare(b.user.name)))
    return people.map((person) => {
      const v = person.user.id === me ? view : scopeFor(db, person.user.id, view.company.id)
      return { person, todos: v ? todosFor(v) : [] }
    })
  }, [db, view, me])

  const canSwitch = courts.length > 1
  const current = selected === 'all' ? null : courts.find((c) => c.person.user.id === selected) ?? courts[0]
  const rows: Row[] = current ? current.todos.map((todo) => ({ person: current.person, todo })) : courts.flatMap((c) => c.todos.map((todo) => ({ person: c.person, todo })))
  const groups = groupTodos(rows.map((r) => r.todo)).map((g) => ({ ...g, rows: rows.filter((r) => g.items.includes(r.todo)) }))
  const total = rows.length
  const everyoneTotal = courts.reduce((a, c) => a + c.todos.length, 0)
  const mine = current?.person.user.id === me
  const title = !current ? "Everyone's court" : mine ? 'In your court' : `In ${firstName(current.person.user.name)}'s court`
  const canResolveFlags = view.viewer.role === 'MD' || view.viewer.role === 'Principal'

  // Cap the list, but never cut a group header off from its first row.
  let budget = all ? Infinity : SHOW
  const shownGroups = groups
    .map((g) => {
      const take = g.rows.slice(0, Math.max(0, budget))
      budget -= take.length
      return { ...g, rows: take }
    })
    .filter((g) => g.rows.length)

  const pick = (id: string) => {
    setSelected(id)
    setAll(false)
  }

  return (
    <section className={clsx('overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-xs', className)} aria-label={title}>
      <header className="flex min-h-10 flex-wrap items-center gap-x-2 gap-y-1 border-b border-zinc-100 px-3.5 py-2">
        <h2 className="flex items-center gap-2 text-[13px] font-semibold text-zinc-800">
          <Inbox className="size-4 text-accent" /> {title}
          <span className="tabular rounded bg-zinc-100 px-1.5 text-xs font-medium text-zinc-600">{total}</span>
        </h2>
        <span className="ml-auto text-xs text-zinc-400">{mine ? 'What only you can move forward' : 'Sorted by what is most urgent'}</span>
      </header>

      {canSwitch && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-zinc-100 bg-zinc-50/60 px-3.5 py-2" role="tablist" aria-label="Whose court">
          {courts.map(({ person, todos }) => {
            const active = current?.person.user.id === person.user.id
            const isMe = person.user.id === me
            return (
              <button
                key={person.user.id}
                role="tab"
                aria-selected={active}
                onClick={() => pick(person.user.id)}
                title={`${person.user.name} · ${person.user.title || person.role}`}
                className={clsx(
                  'inline-flex h-7 items-center gap-1.5 rounded-full border pr-2.5 pl-1 text-xs font-medium transition',
                  active ? 'border-zinc-900 bg-zinc-900 text-white' : todos.length ? 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100' : 'border-zinc-200 bg-white text-zinc-400 hover:bg-zinc-100',
                )}
              >
                <Avatar name={person.user.name} size={20} className="ring-0" />
                {isMe ? 'You' : firstName(person.user.name)}
                <span className={clsx('tabular rounded px-1 text-[11px]', active ? 'bg-white/20' : todos.length ? 'bg-zinc-100 text-zinc-600' : 'text-zinc-400')}>{todos.length}</span>
              </button>
            )
          })}
          <button
            role="tab"
            aria-selected={!current}
            onClick={() => pick('all')}
            className={clsx('inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition', !current ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100')}
          >
            Everyone
            <span className={clsx('tabular rounded px-1 text-[11px]', !current ? 'bg-white/20' : 'bg-zinc-100 text-zinc-600')}>{everyoneTotal}</span>
          </button>
        </div>
      )}

      {!total ? (
        <div className="flex items-center gap-2 px-3.5 py-5 text-[13px] text-zinc-500">
          <CheckCheck className="size-4 text-green-600" />
          {mine ? 'Nothing is waiting on you right now.' : !current ? 'Nothing is waiting on anyone.' : `Nothing is waiting on ${firstName(current.person.user.name)}.`}
        </div>
      ) : (
        <div>
          {shownGroups.map((g) => (
            <div key={g.key}>
              <div
                className={clsx(
                  'flex items-center gap-2 px-3.5 pt-2.5 pb-1 text-[11px] font-semibold tracking-wide uppercase',
                  g.tone === 'bad' ? 'text-red-700' : g.tone === 'warn' ? 'text-amber-700' : g.tone === 'normal' ? 'text-zinc-600' : 'text-zinc-400',
                )}
              >
                {g.label}
                <span className="tabular font-medium normal-case text-zinc-400">{g.items.length}</span>
              </div>
              <ul className="divide-y divide-zinc-50">
                {g.rows.map(({ person, todo: t }) => (
                  <li key={`${person.user.id}:${t.id}`}>
                    <Link to={t.to} className="group flex items-center gap-3 px-3.5 py-2 hover:bg-zinc-50">
                      {!current ? (
                        <Avatar name={person.user.name} size={24} />
                      ) : (
                        <span className={clsx('grid size-6 shrink-0 place-items-center rounded-full', t.kind === 'flag' ? 'bg-red-50 text-red-600' : t.kind === 'pillar' ? 'bg-amber-50 text-amber-700' : 'bg-accent-soft text-accent')}>
                          {t.kind === 'flag' ? <Flag className="size-3.5" /> : t.kind === 'pillar' ? <Clock className="size-3.5" /> : <Inbox className="size-3.5" />}
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-zinc-900">{t.action}</span>
                        <span className="block truncate text-xs text-zinc-500">
                          {!current && <span className="text-zinc-700">{firstName(person.user.name)} · </span>}
                          {t.title}
                        </span>
                      </span>
                      {t.dueDate && (
                        <span className={clsx('tabular shrink-0 text-xs', t.overdue ? 'font-semibold text-red-600' : 'text-zinc-500')}>
                          {t.overdue ? 'Overdue · ' : 'Due '}
                          {fmtDate(t.dueDate)}
                        </span>
                      )}
                      {t.updateId && canResolveFlags && mine ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault()
                            resolveFlag('update', t.updateId!)
                          }}
                          className="shrink-0 rounded-md border border-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                        >
                          Mark resolved
                        </button>
                      ) : (
                        <ArrowRight className="size-4 shrink-0 text-zinc-300 transition group-hover:translate-x-0.5 group-hover:text-accent" />
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {total > SHOW && (
            <button onClick={() => setAll((v) => !v)} className="w-full border-t border-zinc-100 px-3.5 py-2 text-left text-xs font-medium text-accent hover:bg-zinc-50">
              {all ? 'Show fewer' : `Show all ${total}`}
            </button>
          )}
        </div>
      )}
    </section>
  )
}

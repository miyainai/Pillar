import { useState, type DragEvent } from 'react'
import clsx from 'clsx'
import { X } from 'lucide-react'
import type { Member } from '../lib/permissions'
import { Avatar } from './ui'

const MIME = 'application/x-pillar-person'
const firstName = (name: string) => name.split(' ')[0]

/**
 * Who is on it: drag people from the bench into the box (or click them). Drag them back out,
 * or click the x, to take them off. Hover a face for the full name and function.
 */
export function PeoplePicker({
  people,
  selected,
  onChange,
  disabled,
  max,
  boxLabel = 'Assigned',
  benchLabel = 'Drag someone in, or click their name',
  emptyText = 'Nobody yet. Drag someone in.',
}: {
  people: Member[]
  selected: string[]
  onChange: (ids: string[]) => void
  disabled?: boolean
  /** Cap on how many can be in the box (1 for a single recipient). */
  max?: number
  boxLabel?: string
  benchLabel?: string
  emptyText?: string
}) {
  const [overBox, setOverBox] = useState(false)
  const [overBench, setOverBench] = useState(false)
  const [dragging, setDragging] = useState<string | null>(null)
  const chosen = selected.map((id) => people.find((m) => m.user.id === id)).filter((m): m is Member => !!m)
  const bench = people.filter((m) => !selected.includes(m.user.id))
  const full = max !== undefined && chosen.length >= max

  const add = (id: string) => {
    if (disabled || selected.includes(id)) return
    onChange(max === 1 ? [id] : full ? selected : [...selected, id])
  }
  const remove = (id: string) => {
    if (disabled) return
    onChange(selected.filter((x) => x !== id))
  }
  const start = (e: DragEvent, id: string) => {
    e.dataTransfer.setData(MIME, id)
    e.dataTransfer.effectAllowed = 'move'
    setDragging(id)
  }
  const idFrom = (e: DragEvent) => e.dataTransfer.getData(MIME)
  const allow = (e: DragEvent) => {
    if (disabled || !e.dataTransfer.types.includes(MIME)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const person = (m: Member, inBox: boolean) => (
    <button
      key={m.user.id}
      type="button"
      draggable={!disabled}
      onDragStart={(e) => start(e, m.user.id)}
      onDragEnd={() => setDragging(null)}
      onClick={() => (inBox ? remove(m.user.id) : add(m.user.id))}
      disabled={disabled || (!inBox && full && max !== 1)}
      title={`${m.user.name} · ${m.user.title || m.role}${inBox ? ' · click or drag out to remove' : full && max !== 1 ? '' : ' · click or drag in to assign'}`}
      aria-label={`${inBox ? 'Remove' : 'Assign'} ${m.user.name}`}
      className={clsx(
        'group inline-flex h-8 items-center gap-1.5 rounded-full border pr-2 pl-0.5 text-xs font-medium transition select-none',
        inBox ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50',
        dragging === m.user.id && 'opacity-40',
        disabled ? 'cursor-default' : 'cursor-grab active:cursor-grabbing',
        !inBox && full && max !== 1 && 'opacity-50',
      )}
    >
      <Avatar name={m.user.name} size={24} className="ring-0" />
      {inBox ? m.user.name : firstName(m.user.name)}
      {inBox && !disabled && <X className="size-3 text-white/60 group-hover:text-white" />}
    </button>
  )

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => {
          allow(e)
          setOverBox(true)
        }}
        onDragLeave={() => setOverBox(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOverBox(false)
          const id = idFrom(e)
          if (id) add(id)
        }}
        aria-label={boxLabel}
        className={clsx(
          'min-h-12 rounded-lg border-2 border-dashed px-2.5 py-2 transition',
          overBox && !disabled ? 'border-accent bg-accent-soft' : chosen.length ? 'border-zinc-200 bg-zinc-50' : 'border-zinc-300 bg-white',
        )}
      >
        <div className="mb-1 text-[11px] font-medium tracking-wide text-zinc-500 uppercase">{boxLabel}</div>
        {chosen.length ? <div className="flex flex-wrap gap-1.5">{chosen.map((m) => person(m, true))}</div> : <div className="text-xs text-zinc-400">{disabled ? 'Nobody.' : emptyText}</div>}
      </div>
      {!disabled && (
        <div
          onDragOver={(e) => {
            allow(e)
            setOverBench(true)
          }}
          onDragLeave={() => setOverBench(false)}
          onDrop={(e) => {
            e.preventDefault()
            setOverBench(false)
            const id = idFrom(e)
            if (id) remove(id)
          }}
          className={clsx('min-h-7 rounded-lg px-1 py-1 transition', overBench && dragging && selected.includes(dragging) && 'bg-zinc-100')}
        >
          <div className="mb-1 px-0.5 text-[11px] text-zinc-400">{bench.length ? benchLabel : 'Everyone is on it. Drag someone here to take them off.'}</div>
          {bench.length > 0 && <div className="flex flex-wrap gap-1.5">{bench.map((m) => person(m, false))}</div>}
        </div>
      )}
    </div>
  )
}

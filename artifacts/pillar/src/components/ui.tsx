import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import { Check, ChevronDown, Lock, Users, X } from 'lucide-react'
import type { AskStatus, PlanStatus, PhaseStatus, Urgency, Visibility } from '../lib/types'
import { useStore } from '../lib/store'

// ---------------- Buttons ----------------

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle'
  size?: 'xs' | 'sm' | 'md'
  icon?: ReactNode
}

export function Button({ variant = 'secondary', size = 'sm', icon, className, children, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      className={clsx(
        'inline-flex items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        size === 'xs' && 'h-6 px-2 text-xs',
        size === 'sm' && 'h-7 px-2.5 text-[13px]',
        size === 'md' && 'h-8 px-3 text-[13px]',
        variant === 'primary' && 'bg-accent text-white shadow-sm hover:bg-accent-hover',
        variant === 'secondary' && 'border border-zinc-200 bg-white text-zinc-800 shadow-xs hover:bg-zinc-50',
        variant === 'ghost' && 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900',
        variant === 'subtle' && 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200',
        variant === 'danger' && 'border border-red-200 bg-white text-red-600 hover:bg-red-50',
        className,
      )}
    >
      {icon}
      {children}
    </button>
  )
}

// ---------------- Status ----------------

export const STATUS_COLOR: Record<string, string> = {
  'On track': 'var(--color-ontrack)',
  'At risk': 'var(--color-atrisk)',
  'Off track': 'var(--color-offtrack)',
  'Not started': 'var(--color-notstarted)',
  Complete: 'var(--color-complete)',
  'In progress': 'var(--color-accent)',
}

export const STATUS_BG: Record<string, string> = {
  'On track': 'bg-green-50 text-green-700 ring-green-600/15',
  'At risk': 'bg-amber-50 text-amber-700 ring-amber-600/20',
  'Off track': 'bg-red-50 text-red-700 ring-red-600/15',
  'Not started': 'bg-zinc-100 text-zinc-600 ring-zinc-500/15',
  Complete: 'bg-blue-50 text-blue-700 ring-blue-600/15',
  'In progress': 'bg-accent-soft text-accent ring-accent/20',
}

export function StatusDot({ status, className }: { status: string; className?: string }) {
  return <span className={clsx('inline-block size-2 shrink-0 rounded-full', className)} style={{ background: STATUS_COLOR[status] ?? '#a1a1aa' }} />
}

export function StatusPill({ status, className }: { status: PlanStatus | PhaseStatus | string; className?: string }) {
  return (
    <span className={clsx('inline-flex h-5 items-center gap-1.5 rounded-full px-2 text-[11.5px] font-medium ring-1 ring-inset whitespace-nowrap', STATUS_BG[status] ?? 'bg-zinc-100 text-zinc-600 ring-zinc-500/15', className)}>
      <StatusDot status={status} className="size-1.5" />
      {status}
    </span>
  )
}

const ASK_STATUS_STYLE: Record<string, string> = {
  New: 'bg-zinc-100 text-zinc-700',
  Open: 'bg-zinc-100 text-zinc-700',
  'In progress': 'bg-accent-soft text-accent',
  'Sent to management': 'bg-violet-50 text-violet-700',
  'Data received': 'bg-amber-50 text-amber-700',
  Delivered: 'bg-green-50 text-green-700',
  Answered: 'bg-green-50 text-green-700',
  Closed: 'bg-zinc-100 text-zinc-500',
}

/** Management sees a simpler set of request states. */
export function mgmtStatusLabel(s: AskStatus) {
  if (s === 'Sent to management') return 'Requested'
  if (s === 'Data received') return 'Uploaded'
  return 'Complete'
}

export function AskStatusPill({ status, mgmt }: { status: AskStatus; mgmt?: boolean }) {
  const label = mgmt ? mgmtStatusLabel(status) : status
  const style = mgmt ? (label === 'Requested' ? ASK_STATUS_STYLE['Sent to management'] : label === 'Uploaded' ? ASK_STATUS_STYLE['Data received'] : ASK_STATUS_STYLE.Delivered) : ASK_STATUS_STYLE[status]
  return <span className={clsx('inline-flex h-5 items-center rounded px-1.5 text-[11.5px] font-medium whitespace-nowrap', style)}>{label}</span>
}

const URGENCY_STYLE: Record<Urgency, string> = {
  Critical: 'text-red-700 bg-red-50 ring-red-600/20',
  High: 'text-orange-700 bg-orange-50 ring-orange-600/20',
  Standard: 'text-zinc-700 bg-zinc-50 ring-zinc-500/20',
  Low: 'text-zinc-500 bg-white ring-zinc-400/20',
}

export function UrgencyBadge({ urgency }: { urgency: Urgency }) {
  return <span className={clsx('inline-flex h-5 items-center rounded px-1.5 text-[11px] font-medium ring-1 ring-inset', URGENCY_STYLE[urgency])}>{urgency}</span>
}

export function VisibilityBadge({ visibility, post, hint }: { visibility: Visibility | 'internal'; post?: boolean; hint?: string }) {
  const shared = visibility === 'shared'
  return (
    <span
      className={clsx(
        'inline-flex h-5 items-center gap-1 rounded px-1.5 text-[11px] font-medium whitespace-nowrap',
        shared ? 'bg-sky-50 text-sky-700' : 'bg-zinc-100 text-zinc-600',
      )}
      title={hint ?? (shared ? 'Visible to management' : 'Visible to the firm only')}
    >
      {shared ? <Users className="size-3" /> : <Lock className="size-3" />}
      {shared ? (post ? 'Shared' : 'Shared') : post ? 'Internal' : 'Firm only'}
    </span>
  )
}

export function VisibilityToggle({
  value,
  onChange,
  disabled,
  post,
}: {
  value: Visibility | 'internal'
  onChange: (v: 'firm' | 'shared') => void
  disabled?: boolean
  post?: boolean
}) {
  const shared = value === 'shared'
  return (
    <div className={clsx('inline-flex h-6 rounded-md border border-zinc-200 bg-white p-0.5 text-[11px] font-medium', disabled && 'opacity-60')}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange('firm')}
        className={clsx('inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded px-1.5', !shared ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-800')}
      >
        <Lock className="size-3" /> {post ? 'Internal' : 'Firm only'}
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange('shared')}
        className={clsx('inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded px-1.5', shared ? 'bg-sky-600 text-white' : 'text-zinc-500 hover:text-zinc-800')}
      >
        <Users className="size-3" /> Shared
      </button>
    </div>
  )
}

// ---------------- People ----------------

const AVATAR_COLORS = ['#5e6ad2', '#0ea5e9', '#16a34a', '#d97706', '#db2777', '#7c3aed', '#0d9488', '#ea580c', '#4b5563']

export function initials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function colorFor(name: string) {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

/** Photo URL for a person, looked up by name so every call site gets photos without plumbing user ids. */
function useAvatarSrc(name: string, src?: string) {
  const users = useStore((s) => s.db.users)
  const url = src ?? users.find((u) => u.name === name)?.avatarUrl
  return url ? `${import.meta.env.BASE_URL}${url.replace(/^\//, '')}` : undefined
}

export function Avatar({ name, size = 20, className, src }: { name: string; size?: number; className?: string; src?: string }) {
  const url = useAvatarSrc(name, src)
  const [broken, setBroken] = useState(false)
  return (
    <span
      title={name}
      className={clsx('inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-white ring-2 ring-white', className)}
      style={{ width: size, height: size, fontSize: size * 0.42, background: colorFor(name) }}
    >
      {url && !broken ? <img src={url} alt="" width={size} height={size} className="size-full object-cover" draggable={false} onError={() => setBroken(true)} /> : initials(name)}
    </span>
  )
}

/** The portfolio company's mark; falls back to a monogram when there is no logo file. */
export function CompanyLogo({ company, size = 28, className }: { company: { name: string; logoUrl?: string }; size?: number; className?: string }) {
  const [broken, setBroken] = useState(false)
  const url = company.logoUrl ? `${import.meta.env.BASE_URL}${company.logoUrl.replace(/^\//, '')}` : undefined
  return (
    <span
      className={clsx('inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-zinc-200 bg-white font-semibold text-zinc-700', className)}
      style={{ width: size, height: size, fontSize: size * 0.45 }}
      aria-hidden
    >
      {url && !broken ? <img src={url} alt="" width={size} height={size} className="size-full object-contain p-[3px]" draggable={false} onError={() => setBroken(true)} /> : company.name[0]}
    </span>
  )
}

export function AvatarStack({ names, size = 20, max = 3 }: { names: string[]; size?: number; max?: number }) {
  if (!names.length) return <span className="text-xs text-zinc-400">Unassigned</span>
  return (
    <span className="inline-flex items-center -space-x-1.5">
      {names.slice(0, max).map((n) => (
        <Avatar key={n} name={n} size={size} />
      ))}
      {names.length > max && <span className="pl-2 text-xs text-zinc-500">+{names.length - max}</span>}
    </span>
  )
}

// ---------------- Layout ----------------

export function Card({ children, className, title, action, pad = true }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode; pad?: boolean }) {
  return (
    <section className={clsx('rounded-lg border border-zinc-200 bg-white shadow-xs', className)}>
      {(title || action) && (
        <header className="flex h-10 items-center justify-between gap-2 border-b border-zinc-100 px-3.5">
          <h3 className="flex items-center gap-2 text-[13px] font-semibold text-zinc-800">{title}</h3>
          <div className="flex items-center gap-1.5">{action}</div>
        </header>
      )}
      <div className={clsx(pad && 'p-3.5')}>{children}</div>
    </section>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[19px] font-semibold tracking-tight text-zinc-900">{title}</h1>
        {subtitle && <div className="mt-0.5 text-[13px] text-zinc-500">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="px-3 py-6 text-center text-[13px] text-zinc-400">{children}</div>
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'good' | 'warn' | 'bad' }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-3.5 py-3 shadow-xs">
      <div className="text-[11.5px] font-medium tracking-wide text-zinc-500 uppercase">{label}</div>
      <div className={clsx('tabular mt-1 text-[20px] font-semibold tracking-tight', tone === 'good' && 'text-green-700', tone === 'warn' && 'text-amber-700', tone === 'bad' && 'text-red-700')}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-zinc-500">{sub}</div>}
    </div>
  )
}

export function ProgressBar({ value, max, className, color = 'var(--color-ontrack)' }: { value: number; max: number; className?: string; color?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className={clsx('h-1.5 overflow-hidden rounded-full bg-zinc-100', className)}>
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

// ---------------- Forms ----------------

/** Use group for controls made of buttons (pickers); a <label> would forward clicks to the first button. */
export function Field({ label, hint, children, className, group }: { label: string; hint?: ReactNode; children: ReactNode; className?: string; group?: boolean }) {
  const Tag = group ? 'div' : 'label'
  return (
    <Tag className={clsx('block', className)} role={group ? 'group' : undefined} aria-label={group ? label : undefined}>
      <span className="mb-1 block text-xs font-medium text-zinc-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11.5px] text-zinc-400">{hint}</span>}
    </Tag>
  )
}

export const inputCls =
  'w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-[13px] shadow-xs outline-none placeholder:text-zinc-400 focus:border-accent focus:ring-2 focus:ring-accent/15 disabled:bg-zinc-50'

export function Select<T extends string>({
  value,
  onChange,
  options,
  className,
  disabled,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[] | T[]
  className?: string
  disabled?: boolean
}) {
  const opts = (options as (T | { value: T; label: string })[]).map((o) => (typeof o === 'string' ? { value: o, label: o } : o))
  return (
    <div className={clsx('relative', className)}>
      <select
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className={clsx(inputCls, 'appearance-none pr-7')}
      >
        {opts.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2 size-3.5 -translate-y-1/2 text-zinc-400" />
    </div>
  )
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="inline-flex h-7 rounded-md border border-zinc-200 bg-white p-0.5 shadow-xs">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={clsx('rounded px-2.5 text-[12.5px] font-medium whitespace-nowrap', value === o.value ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:text-zinc-900')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Click-to-edit text. Commits on blur or Enter; Escape cancels. */
export function InlineText({
  value,
  onSave,
  disabled,
  multiline,
  className,
  placeholder = 'Add…',
}: {
  value: string
  onSave: (v: string) => void
  disabled?: boolean
  multiline?: boolean
  className?: string
  placeholder?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null)
  useEffect(() => setDraft(value), [value])
  useEffect(() => {
    if (editing) ref.current?.focus()
  }, [editing])
  if (!editing || disabled)
    return (
      <span
        onClick={(e) => {
          if (disabled) return
          e.stopPropagation()
          setEditing(true)
        }}
        className={clsx(!disabled && 'cursor-text rounded hover:bg-zinc-100/80', !value && 'text-zinc-400', className)}
      >
        {value || (disabled ? '' : placeholder)}
      </span>
    )
  const commit = () => {
    setEditing(false)
    if (draft.trim() !== value) onSave(draft.trim())
  }
  const props = {
    ref,
    value: draft,
    onClick: (e: React.MouseEvent) => e.stopPropagation(),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(e.target.value),
    onBlur: commit,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (!multiline || e.metaKey)) commit()
      if (e.key === 'Escape') {
        setDraft(value)
        setEditing(false)
      }
    },
    className: clsx(inputCls, 'py-0.5', className),
  }
  return multiline ? <textarea rows={2} {...props} /> : <input {...props} />
}

export function InlineNumber({ value, onSave, disabled, prefix = '$', suffix = 'M', className }: { value: number; onSave: (v: number) => void; disabled?: boolean; prefix?: string; suffix?: string; className?: string }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value))
  useEffect(() => setDraft(String(value)), [value])
  if (!editing || disabled)
    return (
      <span
        onClick={(e) => {
          if (disabled) return
          e.stopPropagation()
          setEditing(true)
        }}
        className={clsx('tabular', !disabled && 'cursor-text rounded px-0.5 hover:bg-zinc-100', className)}
      >
        {prefix}
        {value.toFixed(1)}
        {suffix}
      </span>
    )
  const commit = () => {
    setEditing(false)
    const n = Number(draft)
    if (Number.isFinite(n) && n !== value) onSave(Math.round(n * 100) / 100)
  }
  return (
    <input
      autoFocus
      type="number"
      step="0.1"
      value={draft}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit()
        if (e.key === 'Escape') setEditing(false)
      }}
      className={clsx(inputCls, 'tabular w-20 py-0.5')}
    />
  )
}

// ---------------- Overlays ----------------

export function Modal({ open, onClose, title, children, footer, width = 520 }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; width?: number }) {
  const titleId = useId()
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-zinc-900/30 p-4 pt-[8vh] backdrop-blur-[1px]" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="w-full rounded-xl border border-zinc-200 bg-white shadow-xl" style={{ maxWidth: width }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex h-11 items-center justify-between border-b border-zinc-100 px-4">
          <h2 id={titleId} className="text-[14px] font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>
        <div className="p-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-zinc-100 px-4 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

/** A small popover anchored under its trigger. */
export function Popover({ trigger, children, align = 'left', width = 240 }: { trigger: (open: boolean, toggle: () => void) => ReactNode; children: (close: () => void) => ReactNode; align?: 'left' | 'right'; width?: number }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])
  return (
    <div ref={ref} className="relative inline-block max-w-full align-middle">
      {trigger(open, () => setOpen((o) => !o))}
      {open && (
        <div
          className={clsx('absolute z-40 mt-1 max-h-[70vh] overflow-y-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg', align === 'right' ? 'right-0' : 'left-0')}
          style={{ width }}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}

export function MenuItem({ children, onClick, active, icon, hint }: { children: ReactNode; onClick: () => void; active?: boolean; icon?: ReactNode; hint?: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={clsx('flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[13px] hover:bg-zinc-100', active && 'font-medium')}>
      {icon}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {hint && <span className="shrink-0 text-[11px] text-zinc-400">{hint}</span>}
      {active && <Check className="size-3.5 shrink-0 text-accent" />}
    </button>
  )
}

export function Toast() {
  const toast = useStore((s) => s.toast)
  const showToast = useStore((s) => s.showToast)
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => showToast(null as unknown as string), 3200)
    return () => clearTimeout(t)
  }, [toast, showToast])
  if (!toast) return null
  return createPortal(
    <div className="no-print fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-lg bg-zinc-900 px-3.5 py-2 text-[13px] text-white shadow-lg">{toast}</div>,
    document.body,
  )
}

/** Hidden file input behind a button. Files are recorded by name and size. */
export function FilePicker({ onFiles, children, multiple = true, accept, variant = 'secondary', size = 'sm', icon }: { onFiles: (files: File[]) => void; children: ReactNode; multiple?: boolean; accept?: string; variant?: ButtonProps['variant']; size?: ButtonProps['size']; icon?: ReactNode }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <>
      <input
        ref={ref}
        type="file"
        multiple={multiple}
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          if (files.length) onFiles(files)
          e.target.value = ''
        }}
      />
      <Button type="button" variant={variant} size={size} icon={icon} onClick={() => ref.current?.click()}>
        {children}
      </Button>
    </>
  )
}

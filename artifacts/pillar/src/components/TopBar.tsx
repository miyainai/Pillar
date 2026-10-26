import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { Building2, ChevronsUpDown, Eye, Link2, Plus, RotateCcw } from 'lucide-react'
import { useStore } from '../lib/store'
import { companiesFor, roleOf } from '../lib/permissions'
import { Avatar, CompanyLogo, MenuItem, Popover } from './ui'
import { companyTabPath, demoLink } from '../lib/navigation'
import { switchViewer } from '../lib/persona'

export function Logo() {
  return (
    <span className="inline-flex items-center gap-2 text-[14px] font-semibold tracking-tight text-zinc-900">
      <img src="/favicon.svg" alt="" className="size-5" />
      Pillar
    </span>
  )
}

export function TopBar() {
  const db = useStore((s) => s.db)
  const userId = useStore((s) => s.userId)
  const companyId = useStore((s) => s.companyId)
  const showToast = useStore((s) => s.showToast)
  const resetDemo = useStore((s) => s.resetDemo)
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const me = db.users.find((u) => u.id === userId)!
  const myCompanies = companiesFor(db, userId)
  const current = myCompanies.find((c) => c.id === companyId)
  const role = roleOf(db, userId, companyId)
  const isMgmt = role === 'Management'
  const isFirmAnywhere = db.memberships.some((m) => m.userId === userId && m.role !== 'Management')

  // Stay on the same page when the new viewer can see it; otherwise go to their dashboard.
  const switchUser = (id: string) => {
    const next = switchViewer(id, pathname)
    if (next) navigate(next)
  }

  // Bookmarkable link that opens this exact page as the current persona (for demo scripts).
  const copyDemoLink = async () => {
    try {
      await navigator.clipboard.writeText(demoLink(window.location.href, db, userId))
      showToast('Demo link copied')
    } catch {
      showToast('Could not copy the link')
    }
  }

  // Firm people first, then management grouped by their company.
  const firmUsers = db.users.filter((u) => db.memberships.some((m) => m.userId === u.id && m.role !== 'Management'))
  const mgmtUsers = db.users.filter((u) => db.memberships.some((m) => m.userId === u.id && m.role === 'Management'))
  const roleLabel = (uid: string) => {
    const r = roleOf(db, uid, companyId)
    if (r) return r
    const any = db.memberships.find((m) => m.userId === uid)
    return any ? `${any.role} · other co.` : ''
  }

  const tabs = current
    ? [
        { to: `/c/${companyId}`, label: 'Dashboard', end: true, also: '' },
        { to: `/c/${companyId}/plan`, label: 'Plan', also: `/c/${companyId}/pillars/` },
        { to: `/c/${companyId}/asks`, label: isMgmt ? 'Data requests' : 'Asks' },
        { to: `/c/${companyId}/files`, label: 'Files' },
        ...(isMgmt ? [] : [{ to: `/c/${companyId}/progress`, label: 'Progress' }]),
        ...(isMgmt ? [] : [{ to: `/c/${companyId}/settings`, label: 'Settings' }]),
      ]
    : []

  return (
    <header className="no-print sticky top-0 z-30 border-b border-zinc-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex min-h-12 max-w-[1320px] flex-wrap items-center gap-x-3 px-4 py-1.5 sm:flex-nowrap sm:py-0">
        <NavLink to="/" className="mr-1 shrink-0">
          <Logo />
        </NavLink>
        <span className="text-zinc-300">/</span>

        <Popover
          width={280}
          trigger={(_, toggle) => (
            <button onClick={toggle} aria-label="Switch company" className="flex h-7 min-w-0 items-center gap-1.5 rounded-md px-2 text-[13px] font-medium hover:bg-zinc-100">
              {current ? <CompanyLogo company={current} size={20} /> : <Building2 className="size-3.5 text-zinc-500" />}
              <span className="max-w-[200px] truncate">{current?.name ?? 'Portfolio'}</span>
              <ChevronsUpDown className="size-3.5 text-zinc-400" />
            </button>
          )}
        >
          {(close) => (
            <>
              <div className="px-2.5 pt-1 pb-1.5 text-[11px] font-medium tracking-wide text-zinc-400 uppercase">Your companies</div>
              <MenuItem
                active={!current}
                onClick={() => {
                  close()
                  navigate('/')
                }}
              >
                All companies
              </MenuItem>
              {myCompanies.map((c) => (
                <MenuItem
                  key={c.id}
                  active={c.id === companyId && !!current}
                  hint={roleOf(db, userId, c.id)}
                  icon={<CompanyLogo company={c} size={18} />}
                  onClick={() => {
                    close()
                    navigate(companyTabPath(pathname, c.id, roleOf(db, userId, c.id)))
                  }}
                >
                  {c.name}
                </MenuItem>
              ))}
              {isFirmAnywhere && (
                <>
                  <div className="my-1 border-t border-zinc-100" />
                  <MenuItem
                    icon={<Plus className="size-3.5 text-zinc-500" />}
                    onClick={() => {
                      close()
                      navigate('/setup')
                    }}
                  >
                    Set up a new company
                  </MenuItem>
                </>
              )}
            </>
          )}
        </Popover>

        <nav className="order-last -mx-2 flex w-full items-center gap-0.5 overflow-x-auto sm:order-none sm:mx-0 sm:ml-2 sm:w-auto">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                clsx(
                  'flex h-7 items-center rounded-md px-2.5 text-[13px] whitespace-nowrap',
                  isActive || (t.also && pathname.startsWith(t.also)) ? 'bg-zinc-100 font-medium text-zinc-900' : 'text-zinc-600 hover:text-zinc-900',
                )
              }
            >
              {t.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Popover
            align="right"
            width={300}
            trigger={(_, toggle) => (
              <button onClick={toggle} className="flex h-8 items-center gap-2 rounded-md border border-zinc-200 bg-white pr-2 pl-1.5 shadow-xs hover:bg-zinc-50" title="View as (demo mode)">
                <Eye className="size-3.5 text-zinc-400" />
                <Avatar name={me.name} size={22} />
                <span className="hidden text-left leading-tight sm:block">
                  <span className="block text-[12.5px] font-medium">{me.name}</span>
                  <span className="block max-w-44 truncate text-[11px] text-zinc-500" title={me.title}>{me.title || role || 'Portfolio'}</span>
                </span>
                <ChevronsUpDown className="size-3.5 text-zinc-400" />
              </button>
            )}
          >
            {(close) => (
              <>
                <div className="px-2.5 pt-1 pb-1 text-[11px] text-zinc-500">
                  <span className="font-medium tracking-wide text-zinc-400 uppercase">View as</span> · demo mode, replaces login
                </div>
                <div className="px-2.5 pt-1.5 pb-1 text-[11px] font-medium text-zinc-400">Ashgrove Capital</div>
                {firmUsers.map((u) => (
                  <MenuItem
                    key={u.id}
                    active={u.id === userId}
                    icon={<Avatar name={u.name} size={18} />}
                    hint={roleLabel(u.id)}
                    onClick={() => {
                      close()
                      switchUser(u.id)
                    }}
                  >
                    <span className="block min-w-0 text-left">
                      <span className="block">{u.name}</span>
                      <span className="block text-[11px] font-normal text-zinc-500">{u.title}</span>
                    </span>
                  </MenuItem>
                ))}
                <div className="px-2.5 pt-2 pb-1 text-[11px] font-medium text-zinc-400">Portfolio company management</div>
                {mgmtUsers.map((u) => (
                  <MenuItem
                    key={u.id}
                    active={u.id === userId}
                    icon={<Avatar name={u.name} size={18} />}
                    hint={u.title.split(', ')[1] ?? roleLabel(u.id)}
                    onClick={() => {
                      close()
                      switchUser(u.id)
                    }}
                  >
                    {u.name} <span className="text-zinc-400">· {u.title.split(',')[0]}</span>
                  </MenuItem>
                ))}
                <div className="my-1 border-t border-zinc-100" />
                <MenuItem
                  icon={<Link2 className="size-3.5 text-zinc-500" />}
                  hint={`opens as ${me.name.split(' ')[0]}`}
                  onClick={() => {
                    close()
                    void copyDemoLink()
                  }}
                >
                  Copy demo link
                </MenuItem>
              </>
            )}
          </Popover>
          <button
            onClick={() => {
              if (confirm('Reset all demo data back to the seed? Anything you changed will be lost.')) {
                resetDemo()
                navigate('/c/c-fernhill')
              }
            }}
            className="flex h-8 items-center gap-1.5 rounded-md px-2 text-[12.5px] text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
            title="Reset demo"
          >
            <RotateCcw className="size-3.5" />
            <span className="hidden md:inline">Reset demo</span>
          </button>
        </div>
      </div>
    </header>
  )
}

import { useEffect, type ReactNode } from 'react'
import { Link, Navigate, Outlet, Route, Routes, useParams } from 'react-router-dom'
import { TopBar } from './components/TopBar'
import { Toast } from './components/ui'
import { useStore } from './lib/store'
import { roleOf } from './lib/permissions'
import Portfolio from './pages/Portfolio'
import Dashboard from './pages/Dashboard'
import Builder from './pages/Builder'
import PillarDetail from './pages/PillarDetail'
import AsksBoard from './pages/AsksBoard'
import AskDetail from './pages/AskDetail'
import Progress from './pages/Progress'
import BoardSupplement from './pages/BoardSupplement'
import Settings from './pages/Settings'
import Files from './pages/Files'
import SetupWizard from './pages/SetupWizard'

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/c/:companyId/progress/export" element={<CompanyGate firmOnly><BoardSupplement /></CompanyGate>} />
        <Route element={<Shell />}>
          <Route index element={<Portfolio />} />
          <Route path="setup" element={<SetupWizard />} />
          <Route path="c/:companyId" element={<CompanyGate><Outlet /></CompanyGate>}>
            <Route index element={<Dashboard />} />
            <Route path="plan" element={<Builder />} />
            <Route path="pillars/:pillarId" element={<PillarDetail />} />
            <Route path="asks" element={<AsksBoard />} />
            <Route path="asks/:askId" element={<AskDetail />} />
            <Route path="files" element={<Files />} />
            <Route path="progress" element={<FirmOnly><Progress /></FirmOnly>} />
            <Route path="settings" element={<FirmOnly><Settings /></FirmOnly>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <Toast />
    </>
  )
}

function Shell() {
  return (
    <div className="min-h-full">
      <TopBar />
      <main className="mx-auto max-w-[1320px] px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}

/** Keeps the store's current company in sync with the URL, and blocks non-members. */
function CompanyGate({ children, firmOnly }: { children: ReactNode; firmOnly?: boolean }) {
  const { companyId = '' } = useParams()
  const db = useStore((s) => s.db)
  const userId = useStore((s) => s.userId)
  const current = useStore((s) => s.companyId)
  const setCompany = useStore((s) => s.setCompany)
  const role = roleOf(db, userId, companyId)
  useEffect(() => {
    if (role && current !== companyId) setCompany(companyId)
  }, [role, current, companyId, setCompany])
  if (!role) return <NoAccess />
  if (firmOnly && role === 'Management') return <NoAccess />
  if (current !== companyId) return null
  return <>{children}</>
}

function FirmOnly({ children }: { children: ReactNode }) {
  const db = useStore((s) => s.db)
  const userId = useStore((s) => s.userId)
  const companyId = useStore((s) => s.companyId)
  if (roleOf(db, userId, companyId) === 'Management') return <NoAccess />
  return <>{children}</>
}

function NoAccess() {
  return (
    <div className="mx-auto mt-24 max-w-sm text-center">
      <div className="text-[15px] font-semibold">Nothing to see here</div>
      <p className="mt-1 text-zinc-500">This page isn't available to you. You only see the companies and items you have access to.</p>
      <Link to="/" className="mt-4 inline-block text-accent hover:underline">
        Back to your companies
      </Link>
    </div>
  )
}

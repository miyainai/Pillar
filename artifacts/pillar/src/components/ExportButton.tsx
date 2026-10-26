import { useState } from 'react'
import { FileSpreadsheet, Loader2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { downloadWorkbook, type WorkbookSpec } from '../lib/excel'
import { Button } from './ui'

/**
 * "Export to Excel" for any chart or table. `build` returns the workbook
 * (data sheets, plus the on-screen chart when there is one).
 */
export function ExportButton({
  build,
  label = 'Export to Excel',
  size = 'sm',
  variant = 'secondary',
  className,
}: {
  build: () => WorkbookSpec | Promise<WorkbookSpec>
  label?: string
  size?: 'xs' | 'sm' | 'md'
  variant?: 'primary' | 'secondary' | 'ghost' | 'subtle'
  className?: string
}) {
  const [busy, setBusy] = useState(false)
  const showToast = useStore((s) => s.showToast)
  return (
    <Button
      size={size}
      variant={variant}
      className={className}
      disabled={busy}
      icon={busy ? <Loader2 className="size-3.5 animate-spin" /> : <FileSpreadsheet className="size-3.5" />}
      title="Download the data behind this view, and the chart, as an Excel workbook"
      onClick={async () => {
        setBusy(true)
        try {
          const spec = await build()
          await downloadWorkbook(spec)
          showToast(`Downloaded ${spec.filename}`)
        } catch (e) {
          showToast(`Export failed: ${e instanceof Error ? e.message : String(e)}`)
        } finally {
          setBusy(false)
        }
      }}
    >
      {label}
    </Button>
  )
}

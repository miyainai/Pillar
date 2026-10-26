import { useState } from 'react'
import clsx from 'clsx'
import { Download, Loader2, Paperclip } from 'lucide-react'
import type { View } from '../lib/permissions'
import type { Attachment } from '../lib/types'
import { useStore } from '../lib/store'
import { downloadAttachment } from '../lib/files'
import { fmtSize, userName } from '../lib/selectors'
import { relTime } from '../lib/dates'

/** One attachment, click to download. Anyone who can see the ask or update can download its files. */
export function AttachmentRow({ view, file, about, compact }: { view: View; file: Attachment; about: string; compact?: boolean }) {
  const showToast = useStore((s) => s.showToast)
  const [busy, setBusy] = useState(false)
  const who = userName(view, file.uploadedBy)
  const download = async () => {
    if (busy) return
    setBusy(true)
    try {
      const kind = await downloadAttachment(file, { uploadedBy: who, company: view.company.name, about })
      if (kind === 'sample') showToast(`Downloaded a sample file; the demo does not keep the original of ${file.name}`)
    } catch {
      showToast('Could not download that file')
    } finally {
      setBusy(false)
    }
  }
  if (compact)
    return (
      <button type="button" onClick={download} title={`Download ${file.name} · ${fmtSize(file.size)}`} className="inline-flex items-center gap-1 rounded bg-zinc-100 px-1.5 py-0.5 hover:bg-zinc-200 hover:text-zinc-900">
        {busy ? <Loader2 className="size-3 animate-spin" /> : <Paperclip className="size-3" />} {file.name}
      </button>
    )
  return (
    <button
      type="button"
      onClick={download}
      title={`Download ${file.name}`}
      className={clsx('group flex w-full items-center gap-2 rounded-md border border-zinc-200 px-2.5 py-1.5 text-left text-[12.5px] hover:border-zinc-300 hover:bg-zinc-50', busy && 'opacity-70')}
    >
      {busy ? <Loader2 className="size-3.5 animate-spin text-zinc-400" /> : <Download className="size-3.5 text-zinc-400 group-hover:text-accent" />}
      <span className="min-w-0 flex-1 truncate font-medium">{file.name}</span>
      <span className="shrink-0 text-[11px] text-zinc-400">
        {fmtSize(file.size)} · {who.split(' ')[0]} · {relTime(file.at)}
      </span>
    </button>
  )
}

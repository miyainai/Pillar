import { useState } from 'react'
import type { CommentParent } from '../lib/types'
import type { View } from '../lib/permissions'
import { useStore } from '../lib/store'
import { userName } from '../lib/selectors'
import { relTime } from '../lib/dates'
import { Avatar, Button, VisibilityBadge, VisibilityToggle, inputCls } from './ui'

/**
 * Comment thread with an Internal / Shared toggle. Shared comments reach
 * management only when the parent itself is shared (enforced by scopeFor).
 */
export function Comments({ view, parentType, parentId, parentShared, lockedHint = 'Parent is Firm only, so comments stay internal.' }: { view: View; parentType: CommentParent; parentId: string; parentShared: boolean; lockedHint?: string }) {
  const addComment = useStore((s) => s.addComment)
  const [text, setText] = useState('')
  const [vis, setVis] = useState<'internal' | 'shared'>('internal')
  const list = view.comments.filter((c) => c.parentType === parentType && c.parentId === parentId).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const mgmt = view.viewer.isMgmt

  return (
    <div className="space-y-3">
      {list.map((c) => (
        <div key={c.id} className="flex gap-2.5">
          <Avatar name={userName(view, c.authorId)} size={22} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-medium text-zinc-800">{userName(view, c.authorId)}</span>
              <span className="text-zinc-400">{relTime(c.createdAt)}</span>
              {!mgmt && <VisibilityBadge visibility={c.visibility} post />}
            </div>
            <p className="mt-0.5 text-[13px] whitespace-pre-wrap text-zinc-700">{c.text}</p>
          </div>
        </div>
      ))}
      {!list.length && <div className="text-xs text-zinc-400">No comments yet.</div>}
      <form
        className="flex flex-col gap-2 pt-1"
        onSubmit={(e) => {
          e.preventDefault()
          if (!text.trim()) return
          addComment(view.company.id, parentType, parentId, text, vis)
          setText('')
        }}
      >
        <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder={mgmt ? 'Comment for the deal team…' : 'Add a comment…'} className={inputCls} />
        <div className="flex items-center justify-between gap-2">
          {mgmt ? (
            <span className="text-[11.5px] text-zinc-400">Visible to the deal team and your colleagues.</span>
          ) : (
            <span className="flex items-center gap-2">
              <VisibilityToggle post value={vis} disabled={!parentShared} onChange={(v) => setVis(v === 'shared' ? 'shared' : 'internal')} />
              {!parentShared && <span className="text-[11.5px] text-zinc-400">{lockedHint}</span>}
            </span>
          )}
          <Button type="submit" variant="primary" size="xs" disabled={!text.trim()}>
            Comment
          </Button>
        </div>
      </form>
    </div>
  )
}

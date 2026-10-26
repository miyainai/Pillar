import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { View } from '../lib/permissions'
import { URGENCIES, type Urgency } from '../lib/types'
import { useStore } from '../lib/store'
import { addHours, fromInputDate, nowIso, toInputDate } from '../lib/dates'
import { Button, Field, Modal, Segmented, Select, inputCls } from './ui'

/** Create a data request or question. Due date fills in from urgency and stays editable. */
export function NewAskModal({ view, open, onClose, defaultPillarId }: { view: View; open: boolean; onClose: () => void; defaultPillarId?: string }) {
  const createAsk = useStore((s) => s.createAsk)
  const navigate = useNavigate()
  const [type, setType] = useState<'data_request' | 'question'>('data_request')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [urgency, setUrgency] = useState<Urgency>('Standard')
  const [pillarId, setPillarId] = useState('')
  const [subPillarId, setSubPillarId] = useState('')
  const [due, setDue] = useState('')
  const [dueTouched, setDueTouched] = useState(false)

  const hours = view.settings.urgencyHours
  useEffect(() => {
    if (!dueTouched) setDue(toInputDate(addHours(nowIso(), hours[urgency])))
  }, [urgency, dueTouched, hours])
  useEffect(() => {
    if (open) {
      setPillarId(defaultPillarId ?? '')
      setSubPillarId('')
      setTitle('')
      setBody('')
      setUrgency('Standard')
      setDueTouched(false)
    }
  }, [open, defaultPillarId, view.company.id])

  const subPillars = view.subPillars.filter((s) => s.pillarId === pillarId)

  const submit = () => {
    if (!title.trim() || !view.pillars.some((p) => p.id === pillarId)) return
    const sub = subPillars.find((s) => s.id === subPillarId)
    const dueIso = dueTouched ? fromInputDate(due, true) : addHours(nowIso(), hours[urgency])
    const id = createAsk({
      companyId: view.company.id,
      type,
      title,
      pillarId,
      subPillarId: sub?.id ?? null,
      urgency,
      dueDate: dueIso,
      description: type === 'data_request' ? body : undefined,
      context: type === 'question' ? body : undefined,
    })
    onClose()
    if (id) navigate(`/c/${view.company.id}/asks/${id}`)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New ask"
      width={560}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!title.trim() || !pillarId} onClick={submit}>
            Create {type === 'data_request' ? 'data request' : 'question'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Segmented<'data_request' | 'question'>
          value={type}
          onChange={setType}
          options={[
            { value: 'data_request', label: 'Data request' },
            { value: 'question', label: 'Question' },
          ]}
        />
        <p className="text-[12px] text-zinc-500">
          {type === 'data_request'
            ? 'Goes to the deal team first. If they do not have the data, the associate rewrites it for management.'
            : 'Questions stay inside the firm. The associate can flag it to the MD if it needs a call above the VP.'}
        </p>
        <Field label="Title">
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder={type === 'data_request' ? 'SKU-level COGS by supplier, last 24 months' : 'Can we commit to…?'} />
        </Field>
        <Field label={type === 'data_request' ? 'What you need and why (internal)' : 'Context'}>
          <textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} className={inputCls} placeholder={type === 'data_request' ? 'Need SKU-level COGS by supplier, last 24 months, to size consolidation…' : ''} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Pillar" hint="Required — link the ask to the plan.">
            <Select
              value={pillarId}
              onChange={(id) => {
                setPillarId(id)
                setSubPillarId('')
              }}
              options={[{ value: '', label: 'Choose a pillar' }, ...view.pillars.map((p) => ({ value: p.id, label: `${p.num}. ${p.name}` }))]}
            />
          </Field>
          <Field label="Sub-pillar (optional)" hint={pillarId && !subPillars.length ? 'This pillar has no sub-pillars.' : 'Narrow the request, if needed.'}>
            <Select
              value={subPillarId}
              onChange={setSubPillarId}
              disabled={!pillarId || !subPillars.length}
              options={[{ value: '', label: pillarId ? 'Entire pillar' : 'Choose a pillar first' }, ...subPillars.map((s) => ({ value: s.id, label: `${s.num}. ${s.name}` }))]}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Urgency">
            <Select<Urgency> value={urgency} onChange={setUrgency} options={URGENCIES.map((u) => ({ value: u, label: `${u} (${hours[u] < 48 ? `${hours[u]} hours` : `${Math.round(hours[u] / 24)} days`})` }))} />
          </Field>
          <Field label="Due date">
            <input
              type="date"
              value={due}
              onChange={(e) => {
                setDue(e.target.value)
                setDueTouched(true)
              }}
              className={inputCls}
            />
          </Field>
        </div>
      </div>
    </Modal>
  )
}

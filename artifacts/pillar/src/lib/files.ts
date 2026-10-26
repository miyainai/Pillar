// File contents for attachments. The demo keeps its data in the browser: metadata lives in the
// store, the bytes live in IndexedDB keyed by attachment id. Seeded attachments have no bytes, so
// downloading one builds a small sample file in the right format and says so.

import type { Attachment } from './types'

const DB_NAME = 'pillar-files'
const STORE = 'blobs'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB is not available'))
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode)
        const req = run(t.objectStore(STORE))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
        t.oncomplete = () => db.close()
      }),
  )
}

/** Stores the bytes behind an attachment. Fire-and-forget from store actions. */
export function saveFile(id: string, file: Blob): Promise<void> {
  return tx('readwrite', (s) => s.put(file, id)).then(() => undefined)
}

export function loadFile(id: string): Promise<Blob | null> {
  return tx<Blob | undefined>('readonly', (s) => s.get(id)).then((b) => b ?? null)
}

/** Clears every stored file; used when the demo is reset. */
export function clearFiles(): Promise<void> {
  return tx('readwrite', (s) => s.clear())
    .then(() => undefined)
    .catch(() => undefined)
}

/** The shape store actions accept: either real browser files or bare metadata. */
export type UploadInput = File | { name: string; size: number }

export const isRealFile = (f: UploadInput): f is File => typeof File !== 'undefined' && f instanceof File

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.replace(/[\\/:*?"<>|]+/g, '-')
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export interface SampleContext {
  uploadedBy: string
  company: string
  about: string
}

/**
 * Downloads an attachment. Returns 'stored' when the real upload was found, 'sample' when a
 * placeholder had to be built (seed data or a file uploaded in another browser).
 */
export async function downloadAttachment(att: Attachment, ctx: SampleContext): Promise<'stored' | 'sample'> {
  const stored = await loadFile(att.id).catch(() => null)
  if (stored) {
    triggerDownload(stored, att.name)
    return 'stored'
  }
  triggerDownload(await sampleFile(att, ctx), att.name)
  return 'sample'
}

const ext = (name: string) => name.toLowerCase().split('.').pop() ?? ''

async function sampleFile(att: Attachment, ctx: SampleContext): Promise<Blob> {
  const lines = [
    `Sample file standing in for "${att.name}"`,
    `Uploaded by ${ctx.uploadedBy} · ${ctx.company}`,
    `About: ${ctx.about}`,
    '',
    'This demo keeps files in your browser, so seeded uploads have no real contents. Files you upload yourself download as-is.',
  ]
  const e = ext(att.name)
  if (e === 'xlsx' || e === 'xls' || e === 'csv') {
    if (e === 'csv') return new Blob([lines.map((l) => `"${l.replace(/"/g, '""')}"`).join('\n')], { type: 'text/csv' })
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Sample')
    lines.forEach((l, i) => {
      ws.getCell(i + 1, 1).value = l
      if (i === 0) ws.getCell(1, 1).font = { bold: true, size: 13 }
    })
    ws.getColumn(1).width = 110
    const buf = await wb.xlsx.writeBuffer()
    return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  }
  if (e === 'pdf') return new Blob([simplePdf(lines)], { type: 'application/pdf' })
  return new Blob([lines.join('\n')], { type: 'text/plain' })
}

/** A one-page PDF with a few lines of Helvetica text. Enough for a reader to open. */
function simplePdf(lines: string[]): string {
  const escape = (s: string) => s.replace(/[\\()]/g, (c) => `\\${c}`).replace(/[^\x20-\x7e]/g, '')
  const text = lines.map((l, i) => `BT /F1 ${i === 0 ? 14 : 11} Tf 56 ${760 - i * 22} Td (${escape(l)}) Tj ET`).join('\n')
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let out = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((o, i) => {
    offsets.push(out.length)
    out += `${i + 1} 0 obj\n${o}\nendobj\n`
  })
  const xref = out.length
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const off of offsets) out += `${String(off).padStart(10, '0')} 00000 n \n`
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return out
}

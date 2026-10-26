// Text extraction in the browser, before anything is sent to the AI.
// PDFs keep page markers so the AI can cite "document, page N".

import type { DocType } from './types'

export interface ExtractedDoc {
  name: string
  size: number
  type: DocType
  text: string
  pages?: number
  error?: string
}

export function guessType(name: string): DocType {
  const n = name.toLowerCase()
  if (/\b(ic|investment committee)\b|ic[ _-]?memo|ic[ _-]?deck/.test(n)) return 'IC deck'
  if (/model|\.xlsx?$|\.csv$/.test(n)) return 'Model'
  if (/\bcim\b|confidential information/.test(n)) return 'CIM'
  if (/\bqoe\b|quality of earnings/.test(n)) return 'QoE'
  if (/diligence|dd\b/.test(n)) return 'Diligence report'
  return 'Other'
}

export async function extractText(file: File): Promise<ExtractedDoc> {
  const base = { name: file.name, size: file.size, type: guessType(file.name) }
  const lower = file.name.toLowerCase()
  try {
    if (lower.endsWith('.pdf')) return { ...base, ...(await pdfText(file)) }
    if (/\.(xlsx|xls|csv)$/.test(lower)) return { ...base, text: await sheetText(file) }
    if (/\.(txt|md)$/.test(lower)) return { ...base, text: await file.text() }
    return { ...base, text: '', error: 'Unsupported file type. Export decks to PDF.' }
  } catch (err) {
    return { ...base, text: '', error: `Could not read this file (${err instanceof Error ? err.message : String(err)}).` }
  }
}

async function pdfText(file: File): Promise<{ text: string; pages: number }> {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  const label = file.name.replace(/\.pdf$/i, '')
  const parts: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    const text = content.items.map((it) => ('str' in it ? it.str + (it.hasEOL ? '\n' : ' ') : '')).join('')
    parts.push(`[${label}, page ${i}]\n${text.trim()}`)
  }
  return { text: parts.join('\n\n'), pages: doc.numPages }
}

async function sheetText(file: File): Promise<string> {
  const XLSX = await import('xlsx')
  const wb = XLSX.read(await file.arrayBuffer())
  return wb.SheetNames.map((name) => `[${file.name}, sheet "${name}"]\n${XLSX.utils.sheet_to_csv(wb.Sheets[name])}`).join('\n\n')
}

/** Fetch one of the bundled demo files as if the user had uploaded it. */
export async function demoFile(path: string, name: string, mime: string): Promise<File> {
  const res = await fetch(path)
  const blob = await res.blob()
  return new File([blob], name, { type: mime })
}

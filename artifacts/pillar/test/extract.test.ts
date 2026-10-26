import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import * as XLSX from 'xlsx'
import { extractText } from '../src/lib/extract'

describe('patched SheetJS dependency', () => {
  it('uses the official patched release in the app', () => {
    const release = 'https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz'
    const app = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
    expect(app.devDependencies.xlsx).toBe(release)
    expect(XLSX.version).toBe('0.20.3')
  })
})

describe('spreadsheet text extraction', () => {
  it.each(['xlsx', 'xls'] as const)('retains multiple sheets and values in .%s imports', async (extension) => {
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
      ['Metric', 'Value'], ['Revenue', 125], ['EBITDA', 0], ['Approved', false],
    ]), 'Financials')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
      ['Note'], ['Contains, commas and "quotes"'],
    ]), 'Notes')
    const bytes = XLSX.write(workbook, { type: 'array', bookType: extension === 'xls' ? 'biff8' : 'xlsx' })
    const result = await extractText(new File([bytes], `model.${extension}`))
    expect(result.error).toBeUndefined()
    expect(result.type).toBe('Model')
    expect(result.text).toContain(`[model.${extension}, sheet "Financials"]`)
    expect(result.text).toContain('Revenue,125')
    expect(result.text).toContain('EBITDA,0')
    expect(result.text).toContain('Approved,FALSE')
    expect(result.text).toContain(`[model.${extension}, sheet "Notes"]`)
    expect(result.text).toContain('"Contains, commas and ""quotes"""')
  })

  it('retains CSV imports including quoted fields', async () => {
    const result = await extractText(new File(['Metric,Value\n"Revenue, net",125\n'], 'model.csv'))
    expect(result.error).toBeUndefined()
    expect(result.text).toContain('"Revenue, net",125')
  })

  it('reports unreadable workbook errors rather than silently succeeding', async () => {
    const result = await extractText(new File(['PK\u0003\u0004broken workbook'], 'broken.xlsx'))
    expect(result.text).toBe('')
    expect(result.error).toContain('Could not read this file')
  })
})

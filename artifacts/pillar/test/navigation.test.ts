import { describe, expect, it } from 'vitest'
import { companyTabPath } from '../src/lib/navigation'

describe('switching companies', () => {
  it.each(['plan', 'asks', 'files', 'progress', 'settings'])('preserves the %s tab', (tab) => {
    expect(companyTabPath(`/c/old/${tab}`, 'new', 'MD')).toBe(`/c/new/${tab}`)
  })
  it('uses the corresponding tab instead of carrying item ids across companies', () => {
    expect(companyTabPath('/c/old/asks/ask-1', 'new', 'Associate')).toBe('/c/new/asks')
    expect(companyTabPath('/c/old/pillars/p-1', 'new', 'OP')).toBe('/c/new/plan')
    expect(companyTabPath('/c/old/progress/export', 'new', 'MD')).toBe('/c/new/progress')
  })
  it('does not take management to firm-only tabs', () => {
    expect(companyTabPath('/c/old/progress', 'new', 'Management')).toBe('/c/new')
    expect(companyTabPath('/c/old/settings', 'new', 'Management')).toBe('/c/new')
    expect(companyTabPath('/c/old/asks', 'new', 'Management')).toBe('/c/new/asks')
    expect(companyTabPath('/c/old/files', 'new', 'Management')).toBe('/c/new/files')
  })
  it('opens the dashboard when switching from outside a company', () => {
    expect(companyTabPath('/', 'new', 'MD')).toBe('/c/new')
    expect(companyTabPath('/setup', 'new', 'MD')).toBe('/c/new')
  })
})

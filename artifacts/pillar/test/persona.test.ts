import { describe, expect, it } from 'vitest'
import { buildSeed } from '../src/lib/seed'
import { demoLink, pathAfterSwitch, personaSlug, resolvePersona } from '../src/lib/navigation'

const db = buildSeed()

describe('persona deep links', () => {
  it('resolves user ids and first-name slugs, case-insensitively', () => {
    expect(resolvePersona(db, 'u-sam')).toBe('u-sam')
    expect(resolvePersona(db, 'sam')).toBe('u-sam')
    expect(resolvePersona(db, 'Taylor')).toBe('u-taylor')
    expect(resolvePersona(db, 'taylor-brooks')).toBe('u-taylor')
    expect(resolvePersona(db, 'Taylor Brooks')).toBe('u-taylor')
  })
  it('ignores unknown or empty values', () => {
    expect(resolvePersona(db, 'nobody')).toBeNull()
    expect(resolvePersona(db, '')).toBeNull()
    expect(resolvePersona(db, null)).toBeNull()
  })
  it('does not guess between people who share a first name', () => {
    const twins = { ...db, users: [...db.users, { ...db.users[0], id: 'u-alex-2', name: 'Alex Stone' }] }
    expect(resolvePersona(twins, 'alex')).toBeNull()
    expect(resolvePersona(twins, 'alex-stone')).toBe('u-alex-2')
    expect(personaSlug(twins, 'u-alex')).toBe('u-alex')
  })
  it('prefers the short slug and round-trips through the link', () => {
    expect(personaSlug(db, 'u-taylor')).toBe('taylor')
    const href = demoLink('https://demo.example/c/c-fernhill/asks?tab=open', db, 'u-sam')
    const url = new URL(href)
    expect(url.pathname).toBe('/c/c-fernhill/asks')
    expect(url.searchParams.get('tab')).toBe('open')
    expect(resolvePersona(db, url.searchParams.get('as'))).toBe('u-sam')
  })
})

describe('page after switching viewer', () => {
  it('stays on a page the new viewer can see', () => {
    expect(pathAfterSwitch(db, 'u-sam', '/c/c-fernhill/asks', 'c-fernhill', 'c-fernhill')).toBeNull()
    expect(pathAfterSwitch(db, 'u-taylor', '/c/c-fernhill/asks', 'c-fernhill', 'c-fernhill')).toBeNull()
  })
  it('sends management off firm-only pages to their dashboard', () => {
    expect(pathAfterSwitch(db, 'u-taylor', '/c/c-fernhill/progress', 'c-fernhill', 'c-fernhill')).toBe('/c/c-fernhill')
    expect(pathAfterSwitch(db, 'u-taylor', '/c/c-fernhill/settings', 'c-fernhill', 'c-fernhill')).toBe('/c/c-fernhill')
  })
  it('follows the company change when the viewer cannot see the current one', () => {
    expect(pathAfterSwitch(db, 'u-pat', '/c/c-fernhill/asks/ask-1', 'c-fernhill', 'c-kestrel')).toBe('/c/c-kestrel/asks')
  })
  it('does nothing outside a company', () => {
    expect(pathAfterSwitch(db, 'u-pat', '/', 'c-fernhill', 'c-kestrel')).toBeNull()
  })
})

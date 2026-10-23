import { describe, expect, test } from 'vitest'
import { readPreference, resolveTheme, STORAGE_KEY, writePreference } from './theme'

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  }
}

const throwing = {
  getItem: () => {
    throw new Error('blocked')
  },
  setItem: () => {
    throw new Error('blocked')
  },
  removeItem: () => {
    throw new Error('blocked')
  },
}

describe('readPreference', () => {
  test.each([
    ['light', 'light'],
    ['dark', 'dark'],
    ['purple', 'system'],
  ])('stored %s reads as %s', (stored, expected) => {
    expect(readPreference(memoryStorage({ [STORAGE_KEY]: stored }))).toBe(expected)
  })

  test('nothing stored means follow the system', () => {
    expect(readPreference(memoryStorage())).toBe('system')
  })

  test('blocked or missing storage falls back to system', () => {
    expect(readPreference(throwing)).toBe('system')
    expect(readPreference(undefined)).toBe('system')
  })
})

describe('writePreference', () => {
  test('stores an explicit choice and forgets it for system', () => {
    const s = memoryStorage()
    writePreference(s, 'dark')
    expect(s.data.get(STORAGE_KEY)).toBe('dark')
    writePreference(s, 'system')
    expect(s.data.has(STORAGE_KEY)).toBe(false)
  })

  test('does not throw when storage is blocked', () => {
    expect(() => writePreference(throwing, 'dark')).not.toThrow()
  })
})

describe('resolveTheme', () => {
  test('system follows the OS, explicit choices win', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })
})

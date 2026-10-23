import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import { setMediaQuery } from '../test/setup'
import { DARK_QUERY, STORAGE_KEY } from './theme'
import { ThemeSwitch } from './ThemeSwitch'

const theme = () => document.documentElement.dataset.theme

test('defaults to following the system theme', () => {
  setMediaQuery(DARK_QUERY, true)
  render(<ThemeSwitch />)

  expect(screen.getByRole('radio', { name: 'Auto' })).toBeChecked()
  expect(theme()).toBe('dark')
})

test('tracks the system while on Auto', () => {
  render(<ThemeSwitch />)
  expect(theme()).toBe('light')

  setMediaQuery(DARK_QUERY, true)

  expect(theme()).toBe('dark')
})

test('an explicit choice applies, persists, and ignores the system', async () => {
  render(<ThemeSwitch />)

  await userEvent.click(screen.getByRole('radio', { name: 'Dark' }))
  setMediaQuery(DARK_QUERY, false)

  expect(theme()).toBe('dark')
  expect(localStorage.getItem(STORAGE_KEY)).toBe('dark')
})

test('going back to Auto clears the stored choice', async () => {
  localStorage.setItem(STORAGE_KEY, 'light')
  render(<ThemeSwitch />)
  expect(screen.getByRole('radio', { name: 'Light' })).toBeChecked()

  await userEvent.click(screen.getByRole('radio', { name: 'Auto' }))

  expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
})

test('is operable with the keyboard alone', async () => {
  render(<ThemeSwitch />)

  await userEvent.tab()
  expect(screen.getByRole('radio', { name: 'Auto' })).toHaveFocus()
  await userEvent.keyboard('{ArrowRight}')

  expect(screen.getByRole('radio', { name: 'Light' })).toBeChecked()
  expect(theme()).toBe('light')
})

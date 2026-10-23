import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import App from './App'

test('renders the page question as the only h1', () => {
  render(<App />)

  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
})

test('first Tab reaches the skip link, which targets main', async () => {
  render(<App />)

  await userEvent.tab()

  const skip = screen.getByRole('link', { name: 'Skip to content' })
  expect(skip).toHaveFocus()
  expect(skip).toHaveAttribute('href', '#main')
  expect(document.getElementById('main')).toBeInTheDocument()
})

test('credits the data source with a real link', () => {
  render(<App />)

  expect(screen.getByRole('link', { name: 'Elexon BMRS' })).toHaveAttribute(
    'href',
    'https://bmrs.elexon.co.uk/',
  )
})

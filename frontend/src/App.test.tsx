import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import App from './App'
import { fixtures, installFakeApi, requested } from './test/fakeApi'

const section = (name: RegExp) => screen.getByRole('region', { name }) as HTMLElement

test('renders the page question as the only h1', async () => {
  installFakeApi()
  render(<App />)

  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  await screen.findByText('2,091')
})

test('first Tab reaches the skip link, which targets main', async () => {
  installFakeApi()
  render(<App />)

  await userEvent.tab()

  const skip = screen.getByRole('link', { name: 'Skip to content' })
  expect(skip).toHaveFocus()
  expect(skip).toHaveAttribute('href', '#main')
  expect(document.getElementById('main')).toBeInTheDocument()
})

test('credits the data source with a real link', () => {
  installFakeApi()
  render(<App />)

  expect(screen.getByRole('link', { name: 'Elexon BMRS' })).toHaveAttribute(
    'href',
    'https://bmrs.elexon.co.uk/',
  )
})

test('says what is loading before the data arrives', async () => {
  installFakeApi()
  render(<App />)

  expect(screen.getByRole('status')).toHaveTextContent('Loading the wind data')
  await screen.findByText('2,091')
})

test('opens on day-ahead accuracy for the whole range', async () => {
  const fetch = installFakeApi()
  render(<App />)

  const accuracy = await screen.findByRole('region', { name: /how far off was it/i })
  expect(await within(accuracy).findByText('2,091')).toBeInTheDocument()
  expect(within(accuracy).getByText('1,800 MW')).toBeInTheDocument()
  expect(requested(fetch)).toContain(
    '/api/metrics?start=2026-01-01T00%3A00%3A00.000Z&end=2026-02-02T00%3A00%3A00.000Z&mode=day_ahead&horizon=4',
  )
})

test('turns P90 into the wind to plan on, for any forecast you type', async () => {
  installFakeApi()
  render(<App />)

  const buffer = await screen.findByRole('region', { name: /can you count on/i })
  expect(await within(buffer).findByText('4,251')).toBeInTheDocument()
  expect(within(buffer).getByText('5,749 MW')).toBeInTheDocument()

  const input = within(buffer).getByLabelText('If the forecast for an hour is')
  await userEvent.clear(input)
  await userEvent.type(input, '20000')

  expect(within(buffer).getByText('15,749 MW')).toBeInTheDocument()
})

test('switching to hours ahead shows the slider, refetches, and updates the link', async () => {
  const fetch = installFakeApi()
  render(<App />)
  await screen.findByText('2,091')

  await userEvent.click(screen.getByRole('radio', { name: 'Hours ahead' }))

  const slider = screen.getByRole('slider', { name: /published at least 4 hours before/i })
  expect(slider).toHaveValue('4')
  await waitFor(() =>
    expect(
      requested(fetch).some((u) => u.startsWith('/api/series') && u.includes('mode=horizon')),
    ).toBe(true),
  )
  expect(window.location.search).toBe('?mode=horizon&h=4')
})

test('a shared link restores its selection', async () => {
  window.history.replaceState(null, '', '/?from=2026-01-05&to=2026-01-11&mode=horizon&h=24')
  const fetch = installFakeApi()
  render(<App />)
  await screen.findByText('2,091')

  expect(screen.getByLabelText('From')).toHaveValue('2026-01-05')
  expect(screen.getByLabelText('To')).toHaveValue('2026-01-11')
  expect(screen.getByRole('slider')).toHaveValue('24')
  expect(requested(fetch)).toContain(
    '/api/series?start=2026-01-05T00%3A00%3A00.000Z&end=2026-01-12T00%3A00%3A00.000Z&mode=horizon&horizon=24',
  )
})

test('moving From past To drags To along, and Show every day resets both', async () => {
  installFakeApi()
  render(<App />)
  await screen.findByText('2,091')
  const from = screen.getByLabelText('From')
  const to = screen.getByLabelText('To')

  fireEvent.change(to, { target: { value: '2026-01-10' } })
  fireEvent.change(from, { target: { value: '2026-01-20' } })

  expect(from).toHaveValue('2026-01-20')
  expect(to).toHaveValue('2026-01-20')

  await userEvent.click(screen.getByRole('button', { name: 'Show every day' }))
  expect(from).toHaveValue('2026-01-01')
  expect(to).toHaveValue('2026-02-01')
  expect(screen.getByRole('button', { name: 'Showing every day' })).toBeDisabled()
})

test('a cleared date keeps the last good day and shows it again on blur', async () => {
  const fetch = installFakeApi()
  render(<App />)
  await screen.findByText('2,091')
  const from = screen.getByLabelText('From')

  fireEvent.change(from, { target: { value: '' } })
  expect(from).toHaveValue('')
  fireEvent.blur(from)

  expect(from).toHaveValue('2026-01-01')
  expect(requested(fetch).every((u) => !u.includes('start=&'))).toBe(true)
})

test('a server failure says what failed and Try again recovers', async () => {
  installFakeApi({ meta: { status: 503 } })
  render(<App />)

  expect(await screen.findByRole('alert')).toHaveTextContent(
    "Couldn't load the wind data. The data server isn't responding right now (503).",
  )

  installFakeApi()
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }))

  expect(await screen.findByText('2,091')).toBeInTheDocument()
})

test('a window with nothing to score says why and what to change', async () => {
  window.history.replaceState(null, '', '/?mode=horizon&h=48')
  installFakeApi({ metrics: { ...fixtures.metrics, stats: null } })
  render(<App />)

  const accuracy = await screen.findByRole('region', { name: /how far off was it/i })
  expect(
    await within(accuracy).findByText(
      /no hour in these days has both a forecast published 48 hours ahead/i,
    ),
  ).toBeInTheDocument()
})

test('every chart has its numbers in a table', async () => {
  installFakeApi()
  render(<App />)
  await screen.findByText('2,091')

  const series = section(/what did the forecast say/i)
  await userEvent.click(within(series).getByText('Show every hour as a table'))
  const table = within(series).getByRole('table')
  expect(within(table).getAllByRole('row')).toHaveLength(3)
  expect(within(table).getByText('+1,500 MW')).toBeInTheDocument()

  expect(screen.getByText('Show the bins as a table')).toBeInTheDocument()
  expect(screen.getByText('Show every horizon as a table')).toBeInTheDocument()
  expect(screen.getByText('Show the hours as a table')).toBeInTheDocument()
  expect(screen.getByText('Show the levels as a table')).toBeInTheDocument()
})

test('summarises the breakdown in words', async () => {
  installFakeApi()
  render(<App />)

  expect(
    await screen.findByText('Worst from 03:00, at 2,456 MW; best from 21:00, at 1,804 MW.'),
  ).toBeInTheDocument()
  expect(
    screen.getByText(
      'When under 5 GW was forecast, the average miss was 1,231 MW; at 20 GW or more, 4,543 MW.',
    ),
  ).toBeInTheDocument()
})

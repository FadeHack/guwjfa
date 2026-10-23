import { AppShell } from './layout/AppShell'

export default function App() {
  return (
    <AppShell>
      <section aria-labelledby="page-title" className="pt-10 sm:pt-16">
        <h1 id="page-title" className="max-w-[18ch] text-title">
          How far off was the wind forecast when you had to buy?
        </h1>
        <p className="mt-5 max-w-prose text-ink-muted">
          For every hour of January 2026, the forecast a trader could actually see at decision time,
          against the wind that turned up. Great Britain national generation, from Elexon BMRS.
        </p>
      </section>
    </AppShell>
  )
}

import type { ReactNode } from 'react'
import { ThemeSwitch } from '../theme/ThemeSwitch'
import { Mark } from './Mark'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only z-50 rounded-control bg-surface px-4 py-3 text-label text-ink focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>

      <header className="mx-auto flex w-full max-w-page flex-wrap items-center justify-between gap-x-6 gap-y-3 px-gutter pt-6 pb-4">
        <div className="flex items-center gap-3">
          <Mark className="size-9 shrink-0" />
          <p className="text-label leading-tight">
            <span className="block font-semibold text-ink">Wind forecast monitor</span>
            <span className="block text-ink-muted">GB national wind, January 2026</span>
          </p>
        </div>
        <ThemeSwitch />
      </header>

      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-page flex-1 px-gutter">
        {children}
      </main>

      <footer className="mx-auto w-full max-w-page px-gutter pt-section pb-10 text-caption text-ink-muted">
        <p className="max-w-prose">
          Data from{' '}
          <a
            href="https://bmrs.elexon.co.uk/"
            className="text-ink underline decoration-control underline-offset-4 hover:decoration-ink"
          >
            Elexon BMRS
          </a>{' '}
          (FUELHH actual output, WINDFOR forecasts). Times are shown in UK local time.
        </p>
      </footer>
    </div>
  )
}

import { type ReactNode, useId } from 'react'

/** One trader question per section: the heading asks it, the content answers it. */
export function Section({
  question,
  intro,
  children,
}: {
  question: string
  intro?: ReactNode
  children: ReactNode
}) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="pt-section">
      <h2 id={id} className="max-w-[26ch] text-heading">
        {question}
      </h2>
      {intro && <div className="mt-3 max-w-prose text-ink-muted">{intro}</div>}
      <div className="mt-8 sm:mt-10">{children}</div>
    </section>
  )
}

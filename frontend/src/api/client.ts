// Empty in dev (Vite proxies /api); the deployed frontend points at the backend's origin.
const BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '')

export class ApiError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

type Params = Record<string, string | number | undefined>

export function apiUrl(path: string, params: Params = {}): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) query.set(key, String(value))
  }
  const qs = query.toString()
  return `${BASE}${path}${qs ? `?${qs}` : ''}`
}

export async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  } catch (err) {
    if (signal?.aborted) throw err
    throw new ApiError('The data server could not be reached.', null)
  }
  if (!res.ok) throw new ApiError(await describeFailure(res), res.status)
  return (await res.json()) as T
}

// FastAPI puts a string in `detail`, or a list of {msg} for validation errors.
async function describeFailure(res: Response): Promise<string> {
  try {
    const body: unknown = await res.json()
    const detail = (body as { detail?: unknown }).detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail)) {
      const msgs = detail.map((d) => (d as { msg?: unknown }).msg).filter(Boolean)
      if (msgs.length) return msgs.join('; ')
    }
  } catch {
    // Not JSON; fall through to the status line.
  }
  if (res.status >= 500) return `The data server isn't responding right now (${res.status}).`
  return `The data server answered ${res.status}${res.statusText ? ` ${res.statusText}` : ''}.`
}

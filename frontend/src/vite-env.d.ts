/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend origin for a deployed build, e.g. https://api.example.com. Unset in dev. */
  readonly VITE_API_BASE?: string
}

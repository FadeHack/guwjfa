// Mirrors backend/src/reint_backend/schemas.py. Times are UTC ISO strings.

export type Mode = 'horizon' | 'day_ahead'

export interface Window {
  start: string
  end: string
  mode: Mode
  horizon_hours: number | null
}

export interface Stats {
  count: number
  mae_mw: number
  rmse_mw: number
  bias_mw: number
  nmae: number | null
}

export interface ActualPoint {
  time: string
  generation_mw: number
}

export interface ForecastPoint {
  target_time: string
  publish_time: string
  horizon_hours: number
  generation_mw: number
}

export interface SeriesResponse {
  window: Window
  actual: ActualPoint[]
  forecast: ForecastPoint[]
}

export interface MetricsResponse {
  window: Window
  stats: Stats | null
}

export interface HorizonPoint {
  horizon_hours: number
  stats: Stats | null
}

export interface HorizonResponse {
  start: string
  end: string
  points: HorizonPoint[]
}

export interface Bin {
  lower_mw: number
  upper_mw: number
  count: number
}

export interface Distribution {
  count: number
  bins: Bin[]
  p10_mw: number
  p50_mw: number
  p90_mw: number
}

export interface DistributionResponse {
  window: Window
  bin_width_mw: number
  distribution: Distribution | null
}

export interface HourBreakdown {
  hour: number
  stats: Stats | null
}

export interface LevelBreakdown {
  lower_mw: number
  upper_mw: number | null
  stats: Stats | null
}

export interface BreakdownResponse {
  window: Window
  by_hour: HourBreakdown[]
  by_level: LevelBreakdown[]
}

export interface DataQuality {
  actual_slots_expected: number
  actual_slots_missing: number
  target_hours_without_forecast: number
  forecast_rows_dropped_negative_horizon: number
  off_schedule_runs: string[]
}

export interface MetaResponse {
  available_start: string
  available_end: string
  ingested_at: string | null
  source: string | null
  actual_half_hours: number
  forecast_runs: number
  target_hours: number
  max_horizon_hours: number
  day_ahead_cutoff_local: string
  timezone: string
  quality: DataQuality | null
}

export interface SelectionParams {
  start: string
  end: string
  mode: Mode
  horizon: number
}

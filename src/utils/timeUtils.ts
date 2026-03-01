/**
 * Parse "HH:MM:SS" or "HH:MM" into total minutes from midnight.
 */
function parseToMinutes(time: string): number {
  const parts = time.split(':').map(Number)
  const hours = parts[0] ?? 0
  const minutes = parts[1] ?? 0
  return hours * 60 + minutes
}

/**
 * Calculate total session hours (float), subtracting break durations.
 * @param startTime  "HH:MM:SS"
 * @param endTime    "HH:MM:SS" or null (in-progress)
 * @param breaks     array of { duration: number } in minutes
 */
export function calcTotalHours(
  startTime: string,
  endTime: string | null,
  breaks: { duration: number }[]
): number {
  if (!endTime) return 0

  const startMin = parseToMinutes(startTime)
  const endMin = parseToMinutes(endTime)
  const totalBreakMin = breaks.reduce((acc, b) => acc + b.duration, 0)
  const netMin = endMin - startMin - totalBreakMin

  return Math.max(0, netMin / 60)
}

/**
 * Calculate break duration in minutes from start/end time strings.
 */
export function calcBreakDuration(startTime: string, endTime: string): number {
  const startMin = parseToMinutes(startTime)
  const endMin = parseToMinutes(endTime)
  return Math.max(0, endMin - startMin)
}

/**
 * Format "HH:MM:SS" or "HH:MM" to 12-hour "h:MM AM/PM".
 */
export function formatTime12h(time: string | null): string {
  if (!time) return 'In Progress'

  const parts = time.split(':').map(Number)
  const h = parts[0] ?? 0
  const m = parts[1] ?? 0
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  const minuteStr = m.toString().padStart(2, '0')

  return `${hour12}:${minuteStr} ${period}`
}

/**
 * Convert a native <input type="time"> value "HH:MM" to "HH:MM:SS".
 */
export function toTimeString(hhmm: string): string {
  return hhmm.length === 5 ? `${hhmm}:00` : hhmm
}

/**
 * Convert "HH:MM:SS" to "HH:MM" for use in <input type="time">.
 */
export function toInputTime(time: string | null): string {
  if (!time) return ''
  return time.slice(0, 5)
}

/**
 * Format float hours to "Xh Ym" string.
 */
export function formatHours(hours: number): string {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

/**
 * Format integer minutes to "Xh Ym" string.
 */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

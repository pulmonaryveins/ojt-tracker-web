import { calcTotalHours, toTimeString } from './timeUtils'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ImportRowStatus = 'ready' | 'skip'

export interface ImportRow {
  /** Raw 1-based line number in the CSV (for error messages) */
  line: number
  /** YYYY-MM-DD */
  date: string
  /** HH:MM */
  timeIn: string
  /** HH:MM */
  timeOut: string
  /** Computed net hours (breaks = 0 for import) */
  totalHours: number
  status: ImportRowStatus
  /** Human-readable reason when status === 'skip' */
  reason?: string
}

// ─── CSV Parser ───────────────────────────────────────────────────────────────

/**
 * Minimal RFC-4180-ish CSV parser.
 * Handles quoted fields (including commas inside quotes) and CRLF/LF.
 */
function parseCSVText(text: string): string[][] {
  const rows: string[][] = []
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')

  for (const line of lines) {
    if (!line.trim()) continue
    const fields: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (ch === ',' && !inQuotes) {
        fields.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
    fields.push(current.trim())
    rows.push(fields)
  }

  return rows
}

// ─── Time Parsing ─────────────────────────────────────────────────────────────

/**
 * Parse a time string into "HH:MM" (24-hour).
 * Supports:
 *   "9:01 AM" / "9:01AM" / "09:01 AM"
 *   "5:33 PM" / "17:33" / "5:33PM"
 *   "12:00 PM" (noon) / "12:00 AM" (midnight)
 */
export function parse12hTime(raw: string): string | null {
  if (!raw) return null
  const s = raw.trim().toUpperCase()

  // Try 12-hour with AM/PM
  const match12 = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/)
  if (match12) {
    let h = parseInt(match12[1], 10)
    const m = parseInt(match12[2], 10)
    const period = match12[3]
    if (h < 1 || h > 12 || m < 0 || m > 59) return null
    if (period === 'AM') {
      if (h === 12) h = 0
    } else {
      if (h !== 12) h += 12
    }
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
  }

  // Try 24-hour "HH:MM:SS" or "H:MM:SS" (seconds are discarded)
  const match24s = s.match(/^(\d{1,2}):(\d{2}):\d{2}$/)
  if (match24s) {
    const h = parseInt(match24s[1], 10)
    const m = parseInt(match24s[2], 10)
    if (h < 0 || h > 23 || m < 0 || m > 59) return null
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
  }

  // Try 24-hour "HH:MM" or "H:MM"
  const match24 = s.match(/^(\d{1,2}):(\d{2})$/)
  if (match24) {
    const h = parseInt(match24[1], 10)
    const m = parseInt(match24[2], 10)
    if (h < 0 || h > 23 || m < 0 || m > 59) return null
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
  }

  return null
}

// ─── Date Parsing ─────────────────────────────────────────────────────────────

/**
 * Parse a date string into "YYYY-MM-DD".
 * Supports:
 *   "2026-02-02" (ISO, passthrough)
 *   "02/02/2026" or "2/2/2026" (MM/DD/YYYY)
 *   "02-02-2026" (MM-DD-YYYY)
 */
export function parseDate(raw: string): string | null {
  if (!raw) return null
  const s = raw.trim()

  // ISO: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(s + 'T00:00:00')
    if (isNaN(d.getTime())) return null
    return s
  }

  // MM/DD/YYYY or M/D/YYYY
  const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (slashMatch) {
    const month = slashMatch[1].padStart(2, '0')
    const day   = slashMatch[2].padStart(2, '0')
    const year  = slashMatch[3]
    const iso = `${year}-${month}-${day}`
    const d = new Date(iso + 'T00:00:00')
    if (isNaN(d.getTime())) return null
    return iso
  }

  // MM-DD-YYYY or M-D-YYYY
  const dashMatch = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
  if (dashMatch) {
    const month = dashMatch[1].padStart(2, '0')
    const day   = dashMatch[2].padStart(2, '0')
    const year  = dashMatch[3]
    const iso = `${year}-${month}-${day}`
    const d = new Date(iso + 'T00:00:00')
    if (isNaN(d.getTime())) return null
    return iso
  }

  return null
}

// ─── Main Import Parser ───────────────────────────────────────────────────────

export interface ParseImportResult {
  rows: ImportRow[]
  /** Headers that were detected */
  detectedHeaders: { date: string; timeIn: string; timeOut: string } | null
  /** Fatal error — file could not be parsed at all */
  fatalError?: string
}

/**
 * Parse CSV text into validated import rows.
 *
 * @param csvText   Raw file content
 * @param existingDates  Set of "YYYY-MM-DD" dates already in the DB for this user
 * @param todayStr  "YYYY-MM-DD" — rows after this are future and will be skipped
 */
export function parseImportCSV(
  csvText: string,
  existingDates: Set<string>,
  todayStr: string,
): ParseImportResult {
  const rawRows = parseCSVText(csvText)
  if (rawRows.length === 0) return { rows: [], detectedHeaders: null, fatalError: 'The file appears to be empty.' }

  // ── Detect header row ─────────────────────────────────────────────────────
  const headerRow = rawRows[0].map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''))

  const colIndex = (candidates: string[]): number => {
    for (const c of candidates) {
      const idx = headerRow.findIndex((h) => h === c)
      if (idx !== -1) return idx
    }
    return -1
  }

  const dateCol   = colIndex(['date'])
  const timeInCol = colIndex(['timein', 'timein', 'in', 'clockin', 'start', 'starttime'])
  const timeOutCol = colIndex(['timeout', 'out', 'clockout', 'end', 'endtime'])

  if (dateCol === -1 || timeInCol === -1 || timeOutCol === -1) {
    return {
      rows: [],
      detectedHeaders: null,
      fatalError:
        'Could not find required columns. Make sure your CSV has "Date", "Time In", and "Time Out" headers.',
    }
  }

  const detectedHeaders = {
    date:    rawRows[0][dateCol]    ?? 'Date',
    timeIn:  rawRows[0][timeInCol]  ?? 'Time In',
    timeOut: rawRows[0][timeOutCol] ?? 'Time Out',
  }

  // ── Parse data rows ───────────────────────────────────────────────────────
  const dataRows = rawRows.slice(1)
  const seenDates = new Set<string>()
  const oneYearAgo = new Date(todayStr + 'T00:00:00')
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
  const oneYearAgoStr = oneYearAgo.toISOString().slice(0, 10)

  const rows: ImportRow[] = dataRows.map((fields, idx): ImportRow => {
    const line = idx + 2 // 1-based, header is line 1

    const rawDate    = fields[dateCol]    ?? ''
    const rawTimeIn  = fields[timeInCol]  ?? ''
    const rawTimeOut = fields[timeOutCol] ?? ''

    // ── Parse date ──
    const date = parseDate(rawDate)
    if (!date) {
      return { line, date: rawDate, timeIn: '', timeOut: '', totalHours: 0, status: 'skip', reason: `Unrecognised date "${rawDate}"` }
    }

    // ── Parse times ──
    const timeIn = parse12hTime(rawTimeIn)
    if (!timeIn) {
      return { line, date, timeIn: rawTimeIn, timeOut: '', totalHours: 0, status: 'skip', reason: `Unrecognised time in "${rawTimeIn}"` }
    }

    const timeOut = parse12hTime(rawTimeOut)
    if (!timeOut) {
      return { line, date, timeIn, timeOut: rawTimeOut, totalHours: 0, status: 'skip', reason: `Unrecognised time out "${rawTimeOut}"` }
    }

    // ── Date range checks ──
    if (date > todayStr) {
      return { line, date, timeIn, timeOut, totalHours: 0, status: 'skip', reason: 'Date is in the future' }
    }
    if (date < oneYearAgoStr) {
      return { line, date, timeIn, timeOut, totalHours: 0, status: 'skip', reason: 'Date is more than 1 year ago' }
    }

    // ── Duplicate within CSV ──
    if (seenDates.has(date)) {
      return { line, date, timeIn, timeOut, totalHours: 0, status: 'skip', reason: 'Duplicate date in CSV (only first kept)' }
    }
    seenDates.add(date)

    // ── Already exists in DB ──
    if (existingDates.has(date)) {
      return { line, date, timeIn, timeOut, totalHours: 0, status: 'skip', reason: 'Session already exists for this date' }
    }

    // ── Compute hours ──
    const startTs = toTimeString(timeIn)
    const endTs   = toTimeString(timeOut)
    const totalHours = calcTotalHours(startTs, endTs, [])

    if (totalHours <= 0) {
      return { line, date, timeIn, timeOut, totalHours: 0, status: 'skip', reason: 'Time Out must be after Time In' }
    }
    if (totalHours < 0.25) {
      return { line, date, timeIn, timeOut, totalHours, status: 'skip', reason: 'Session is less than 15 minutes' }
    }
    if (totalHours > 16) {
      return { line, date, timeIn, timeOut, totalHours, status: 'skip', reason: 'Session exceeds 16 hours' }
    }

    return { line, date, timeIn, timeOut, totalHours, status: 'ready' }
  })

  return { rows, detectedHeaders }
}

import { addDays, format, subMonths } from 'date-fns'

export interface PayPeriod {
  periodNumber: number  // 1-based
  startDate: string     // 'yyyy-MM-dd'
  endDate: string       // 'yyyy-MM-dd' inclusive, clamped to today for current period
  hours: number
  earnings: number
  isCurrent: boolean
}

export const PAY_PERIOD_OPTIONS = [
  { value: '7',      label: 'Weekly (7 days)' },
  { value: '15',     label: 'Every 15 days' },
  { value: '30',     label: 'Monthly (30 days)' },
  { value: 'custom', label: 'Custom…' },
]

export function generatePayPeriods(
  payPeriodDays: number,
  effectiveDate: string | null,
  sessions: Array<{ date: string; total_hours: number }>,
  hourlyRate: number,
): PayPeriod[] {
  if (payPeriodDays <= 0) return []

  // Anchor: effective date or 6 months ago
  const anchor = effectiveDate
    ? new Date(effectiveDate + 'T00:00:00')
    : subMonths(new Date(), 6)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Build session lookup map for O(1) access
  const sessionMap = new Map<string, number>()
  for (const s of sessions) {
    sessionMap.set(s.date, (sessionMap.get(s.date) ?? 0) + s.total_hours)
  }

  const periods: PayPeriod[] = []
  let periodStart = new Date(anchor)
  periodStart.setHours(0, 0, 0, 0)
  let periodNumber = 1

  while (periodStart <= today) {
    const periodEnd = addDays(periodStart, payPeriodDays - 1)
    const isCurrent = periodStart <= today && periodEnd >= today

    // Clamp end to today for the current in-progress period
    const displayEnd = periodEnd > today ? today : periodEnd

    const startStr = format(periodStart, 'yyyy-MM-dd')
    const endStr = format(displayEnd, 'yyyy-MM-dd')

    // Sum hours for all sessions in this period
    let hours = 0
    sessionMap.forEach((h, date) => {
      if (date >= startStr && date <= endStr) hours += h
    })

    periods.push({
      periodNumber,
      startDate: startStr,
      endDate: endStr,
      hours,
      earnings: hours * hourlyRate,
      isCurrent,
    })

    periodNumber++
    periodStart = addDays(periodEnd, 1)
  }

  // Most recent first
  return periods.reverse()
}

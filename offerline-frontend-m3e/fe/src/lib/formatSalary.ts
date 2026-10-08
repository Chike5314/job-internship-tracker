import type { Salary } from '@/api/types'

const PERIOD_WORD: Record<string, string> = { HOUR: 'hour', MONTH: 'month', YEAR: 'year' }
const PERIOD_SHORT: Record<string, string> = { HOUR: 'hr', MONTH: 'mo', YEAR: 'yr' }

/**
 * Intl's currency style writes XAF as "FCFA" and repeats the symbol on both
 * ends of a range, which turns a salary into two wrapped lines on a card. The
 * code is written once in front instead, which is how the brand boards set it.
 */
function amounts(salary: Salary, compact: boolean) {
  const formatter = new Intl.NumberFormat('en', {
    maximumFractionDigits: compact ? 1 : 0,
    // Rounding down, so a shortened figure never reads as more money than the
    // posting actually offers. 1,250,000 shows as 1.2m, never 1.3m.
    ...(compact
      ? {
          notation: 'compact' as const,
          compactDisplay: 'short' as const,
          roundingMode: 'floor' as const,
        }
      : {}),
  })
  // Intl writes the compact suffix in capitals; the boards set it lower case.
  const write = (value: number) =>
    compact ? formatter.format(value).replace(/([KMB])$/, (s) => s.toLowerCase()) : formatter.format(value)

  if (salary.min != null && salary.max != null && salary.min !== salary.max) {
    return `${write(salary.min)}–${write(salary.max)}`
  }
  const single = salary.min ?? salary.max
  return single != null ? write(single) : null
}

/**
 * `compact` is for cards, where the figure is a signal and the space is one
 * line. A posting's own page leaves it off and shows the exact number, which
 * is what somebody deciding whether to apply is actually reading.
 *
 * `shortPeriod` writes "/ mo" for a list row, where the figure sits in a fixed
 * column beside the title and "/ month" would wrap it.
 */
export function formatSalary(
  salary: Salary,
  options: { compact?: boolean; shortPeriod?: boolean } = {},
): string {
  if (!salary.disclosed) return ''
  const figure = amounts(salary, options.compact ?? false)
  if (figure == null) return ''
  const currency = salary.currency ?? 'USD'
  const words = options.shortPeriod ? PERIOD_SHORT : PERIOD_WORD
  const period = salary.period ? ` / ${words[salary.period]}` : ''
  return `${currency} ${figure}${period}`
}

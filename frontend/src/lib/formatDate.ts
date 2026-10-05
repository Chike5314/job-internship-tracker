const dateFormatter = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'long' })
const dateTimeFormatter = new Intl.DateTimeFormat('en', {
  day: 'numeric',
  month: 'long',
  hour: 'numeric',
  minute: '2-digit',
})
const relativeFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
// For dense surfaces such as a board card, where "October 2" costs a line that
// "2 Oct" does not.


export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso))
}

// Day before month, which is both the design's order and the one used where
// this product is being built. Intl writes "Sept" for the one month whose
// short form it does not abbreviate to three letters, so the month part is
// trimmed to keep every date the same width.
const partsFormatter = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})
const clockFormatter = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

function dayAndMonth(date: Date, withWeekday: boolean): string {
  const parts = partsFormatter.formatToParts(date)
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  const stem = `${get('day')} ${get('month').slice(0, 3)}`
  return withWeekday ? `${get('weekday')} ${stem}` : stem
}

/**
 * "Tue 29 Sep · 10:00–11:00". An interview is a thing somebody has to turn up
 * to, so the weekday and the end time both earn their place: the day tells you
 * whether it clashes, the end tells you how long to keep free.
 */
export function formatInterviewWhen(iso: string, durationMinutes: number): string {
  const start = new Date(iso)
  const end = new Date(start.getTime() + durationMinutes * 60_000)
  return `${dayAndMonth(start, true)} · ${clockFormatter.format(start)}\u2013${clockFormatter.format(end)}`
}

/** "Mon 28 Sep, 14:00", for naming a time that no longer stands. */
export function formatInterviewMoment(iso: string): string {
  const at = new Date(iso)
  return `${dayAndMonth(at, true)}, ${clockFormatter.format(at)}`
}

export function formatDateShort(iso: string): string {
  return dayAndMonth(new Date(iso), false)
}

const yearFormatter = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

function withYear(date: Date, withWeekday: boolean): string {
  const parts = yearFormatter.formatToParts(date)
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  const stem = `${get('day')} ${get('month').slice(0, 3)} ${get('year')}`
  return withWeekday ? `${get('weekday')} ${stem}` : stem
}

/** "2 Nov 2026", for a date far enough ahead that the year matters. */
export function formatDayMonthYear(date: Date): string {
  return withYear(date, false)
}

/** "Fri 9 Oct 2026", for a day somebody is choosing as a deadline. */
export function formatWeekdayDayMonthYear(date: Date): string {
  return withYear(date, true)
}

/** "10:00", on the 24 hour clock. */
export function formatClock(iso: string): string {
  return clockFormatter.format(new Date(iso))
}

/** "Sun 5 Oct", for a line that names today. */
export function formatWeekdayDate(date: Date): string {
  return dayAndMonth(date, true)
}

const longDateFormatter = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

/**
 * "Friday, 25 September 2026". Assembled from parts because en-GB drops the
 * comma after the weekday in some engines and keeps it in others.
 */
export function formatLongDate(date: Date): string {
  const parts = longDateFormatter.formatToParts(date)
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  return `${get('weekday')}, ${get('day')} ${get('month')} ${get('year')}`
}

/**
 * "Today", "Yesterday", then "21 Sep", with the year added once it is not this
 * one. For a list column, where a day is as fine as the reader needs.
 */
export function formatDay(iso: string, now: number = Date.now()): string {
  const then = new Date(iso)
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  if (then.getTime() >= today.getTime()) return 'Today'
  if (then.getTime() >= today.getTime() - 24 * 60 * 60 * 1000) return 'Yesterday'
  const stem = dayAndMonth(then, false)
  return then.getFullYear() === today.getFullYear() ? stem : `${stem} ${then.getFullYear()}`
}

/**
 * "12 min ago", "2 h ago", "Yesterday", then the date itself. For a list row,
 * where how recent something is matters for a day or so and after that the
 * date is easier to place than a count of days.
 */
export function formatAgo(iso: string, now: number = Date.now()): string {
  const then = new Date(iso)
  const minutes = Math.floor((now - then.getTime()) / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h ago`

  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const yesterday = today.getTime() - 24 * 60 * 60 * 1000
  if (then.getTime() >= yesterday) return 'Yesterday'
  return dayAndMonth(then, false)
}

export function formatDateTime(iso: string): string {
  return dateTimeFormatter.format(new Date(iso))
}

export function formatRelativeTime(iso: string): string {
  const diffMs = new Date(iso).getTime() - Date.now()
  const diffMinutes = Math.round(diffMs / 60_000)
  if (Math.abs(diffMinutes) < 60) return relativeFormatter.format(diffMinutes, 'minute')
  const diffHours = Math.round(diffMinutes / 60)
  if (Math.abs(diffHours) < 24) return relativeFormatter.format(diffHours, 'hour')
  const diffDays = Math.round(diffHours / 24)
  return relativeFormatter.format(diffDays, 'day')
}

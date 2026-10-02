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
const shortDateFormatter = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short' })

export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso))
}

export function formatDateShort(iso: string): string {
  return shortDateFormatter.format(new Date(iso))
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

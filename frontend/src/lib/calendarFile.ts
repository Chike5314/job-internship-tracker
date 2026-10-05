/**
 * An .ics file for one interview, built in the browser.
 *
 * The alternative is a backend route that returns the same six lines, which
 * would cost a round trip to assemble text the page already holds.
 */

/** iCalendar wants UTC as YYYYMMDDTHHMMSSZ, with no punctuation. */
function stamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

/** Commas, semicolons and newlines carry meaning in a property value. */
function escapeText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/([,;])/g, '\\$1').replace(/\r?\n/g, '\\n')
}

export function interviewCalendarFile(params: {
  title: string
  company: string
  scheduledAt: string
  durationMinutes: number
  location: string
  uid: string
}): Blob {
  const start = new Date(params.scheduledAt)
  const end = new Date(start.getTime() + params.durationMinutes * 60_000)

  // CRLF throughout: RFC 5545 asks for it, and some calendar clients refuse a
  // file that uses bare newlines.
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Offerline//Interview//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${params.uid}@offerline`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${escapeText(`${params.title} · ${params.company}`)}`,
    `LOCATION:${escapeText(params.location)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]

  return new Blob([lines.join('\r\n') + '\r\n'], { type: 'text/calendar;charset=utf-8' })
}

/** Hands the file to the browser and releases the object URL afterwards. */
export function downloadCalendarFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

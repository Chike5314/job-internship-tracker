import { useState, type FormEvent } from 'react'
import type { InterviewMode } from '@/api/enums'
import type { Interview } from '@/api/types'
import { Button } from '@/ui/Button'
import { Input } from '@/ui/Input'
import { Select } from '@/ui/Select'
import { formatWeekdayDate } from '@/lib/formatDate'
import type { InterviewSlot } from './useCompany'
import styles from './ApplicationDrawer.module.css'

/** How far ahead the date list reaches. */
const DAYS_AHEAD = 30
const DURATIONS = [30, 45, 60]
const MODES: { key: InterviewMode; label: string }[] = [
  { key: 'ONSITE', label: 'Onsite' },
  { key: 'ONLINE', label: 'Online' },
]

const pad = (n: number) => String(n).padStart(2, '0')
const dayValue = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
const timeValue = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`

/** Half hours across a working day, with the time being moved kept in the
 *  list even when it falls outside one. */
function timeOptions(keep: string): { value: string; label: string }[] {
  const times: string[] = []
  for (let minutes = 8 * 60; minutes <= 18 * 60; minutes += 30) {
    times.push(`${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`)
  }
  if (!times.includes(keep)) times.push(keep)
  return times.sort().map((time) => ({ value: time, label: time }))
}

function dayOptions(today: Date, keep: Date): { value: string; label: string }[] {
  const days: { value: string; label: string }[] = []
  for (let offset = 0; offset < DAYS_AHEAD; offset += 1) {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset)
    days.push({
      value: dayValue(day),
      label: offset === 0 ? `${formatWeekdayDate(day)} (today)` : formatWeekdayDate(day),
    })
  }
  if (!days.some((day) => day.value === dayValue(keep))) {
    days.push({ value: dayValue(keep), label: formatWeekdayDate(keep) })
  }
  return days
}

type Problem = { field: 'time' | 'place'; message: string } | null

/**
 * The time, length, mode and place of one interview. A time being moved
 * starts from where it stands; a new one starts tomorrow at ten, at the
 * company's own office.
 */
export function InterviewForm({
  title,
  first,
  from,
  officeAddress,
  pending,
  onSubmit,
  onCancel,
  askRoundName = false,
  note,
  submitLabel,
}: {
  title: string
  /** The applicant's first name, for the line about who is told. */
  first: string
  /** The interview being moved or replaced, which the form starts from. */
  from?: Interview
  officeAddress?: string
  pending: boolean
  onSubmit: (slot: InterviewSlot) => void
  onCancel: () => void
  /** Offers a name for the round, for a new booking rather than a move. */
  askRoundName?: boolean
  /** A line under the title, for anything the form does beyond one booking. */
  note?: string
  submitLabel?: string
}) {
  const [initial] = useState(() => {
    const today = new Date()
    const start = from ? new Date(from.scheduledAt) : null
    const fallback = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1, 10, 0)
    // A time already past cannot be sent again, so only a future one is kept.
    const at = start && start.getTime() > today.getTime() ? start : fallback
    return { today, at }
  })
  const [day, setDay] = useState(dayValue(initial.at))
  const [time, setTime] = useState(timeValue(initial.at))
  const [duration, setDuration] = useState(from?.durationMinutes ?? 45)
  const [mode, setMode] = useState<InterviewMode>(from?.mode ?? 'ONSITE')
  const [place, setPlace] = useState(from?.locationOrLink ?? officeAddress ?? '')
  const [problem, setProblem] = useState<Problem>(null)
  const [roundLabel, setRoundLabel] = useState('')

  const days = dayOptions(initial.today, initial.at)
  const times = timeOptions(timeValue(initial.at))
  const durations = DURATIONS.includes(duration) ? DURATIONS : [...DURATIONS, duration].sort((a, b) => a - b)
  const online = mode === 'ONLINE'

  function pickMode(next: InterviewMode) {
    setProblem(null)
    if (next === mode) return
    setMode(next)
    // An address and a meeting link are never the same thing, so switching
    // clears the field, and Onsite fills in the office again.
    setPlace(next === 'ONSITE' ? (officeAddress ?? '') : '')
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const [year, month, date] = day.split('-').map(Number)
    const [hours, minutes] = time.split(':').map(Number)
    const start = new Date(year!, month! - 1, date!, hours!, minutes!)
    if (start.getTime() <= Date.now()) {
      setProblem({ field: 'time', message: 'That time has already passed today. Pick a later time.' })
      return
    }
    if (!place.trim()) {
      setProblem({ field: 'place', message: online ? 'Add the meeting link.' : 'Add the address.' })
      return
    }
    onSubmit({
      scheduledAt: start.toISOString(),
      mode,
      durationMinutes: duration,
      locationOrLink: place.trim(),
      ...(askRoundName && roundLabel.trim() ? { roundLabel: roundLabel.trim() } : {}),
    })
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <p className={styles.formTitle}>{title}</p>
      {note && <p className={styles.controlLabel}>{note}</p>}
      {askRoundName && (
        <label className={styles.control}>
          <span className={styles.controlLabel}>Round name (optional)</span>
          <Input
            value={roundLabel}
            onChange={(event) => setRoundLabel(event.target.value)}
            maxLength={60}
            placeholder="Technical, Panel, Final"
            className={styles.input}
          />
        </label>
      )}
      <div className={styles.pair}>
        <label className={styles.control}>
          <span className={styles.controlLabel}>Date</span>
          <Select
            value={day}
            onChange={(event) => {
              setDay(event.target.value)
              setProblem(null)
            }}
            options={days}
            className={styles.input}
          />
        </label>
        <label className={styles.control}>
          <span className={styles.controlLabel}>Start time</span>
          <Select
            value={time}
            onChange={(event) => {
              setTime(event.target.value)
              setProblem(null)
            }}
            options={times}
            className={styles.input}
            aria-invalid={problem?.field === 'time' ? true : undefined}
          />
        </label>
      </div>

      <div className={styles.toggles}>
        <div className={styles.control} role="group" aria-label="Length">
          <span className={styles.controlLabel}>Length</span>
          <span className={styles.toggleRow}>
            {durations.map((minutes) => (
              <button
                key={minutes}
                type="button"
                aria-pressed={duration === minutes}
                className={[styles.toggle, duration === minutes ? styles.toggleOn : ''].join(' ')}
                onClick={() => setDuration(minutes)}
              >
                {minutes} min
              </button>
            ))}
          </span>
        </div>
        <div className={styles.control} role="group" aria-label="Mode">
          <span className={styles.controlLabel}>Mode</span>
          <span className={styles.toggleRow}>
            {MODES.map((option) => (
              <button
                key={option.key}
                type="button"
                aria-pressed={mode === option.key}
                className={[styles.toggle, mode === option.key ? styles.toggleOn : ''].join(' ')}
                onClick={() => pickMode(option.key)}
              >
                {option.label}
              </button>
            ))}
          </span>
        </div>
      </div>

      <label className={styles.control}>
        <span className={styles.controlLabel}>{online ? 'Meeting link' : 'Address'}</span>
        <Input
          type={online ? 'url' : 'text'}
          value={place}
          onChange={(event) => {
            setPlace(event.target.value)
            setProblem(null)
          }}
          placeholder={online ? 'https://' : 'Street, area, city'}
          className={styles.input}
          aria-invalid={problem?.field === 'place' ? true : undefined}
        />
      </label>

      {problem && (
        <p role="alert" className={styles.problem}>
          {problem.message}
        </p>
      )}

      <div className={styles.formActions}>
        <Button type="submit" variant="primary" className={styles.grow} loading={pending}>
          {submitLabel ?? 'Send invitation'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
      </div>
      <p className={styles.formNote}>
        {first} and you both get an email with a calendar file. {first} can confirm or decline.
      </p>
    </form>
  )
}

import type { Interview } from '@/api/types'

/**
 * The interview an application's card is about: the latest one a reschedule
 * has not replaced. While PROPOSED it is the one a reply goes to, which is what
 * _latest_open_interview in application_service/handler.py answers as well. A
 * declined time stays shown so the reply reads back on the card.
 */
export function currentInterview(interviews: Interview[]): Interview | undefined {
  for (let i = interviews.length - 1; i >= 0; i -= 1) {
    const interview = interviews[i]
    if (interview && interview.state !== 'CANCELLED') return interview
  }
  return undefined
}

/**
 * Which round an interview is on its application: one more than the interviews
 * confirmed before it. A reschedule or a declined time leaves the count where
 * it was, since neither is a round that took place. An interview record carries
 * no kind, so the round is what names it.
 */
export function interviewRound(interviews: Interview[], interview: Interview): number {
  // Interviews booked since rounds were added carry their round.
  if (interview.round) return interview.round
  const at = new Date(interview.scheduledAt).getTime()
  return (
    1 +
    interviews.filter(
      (other) => other.state === 'CONFIRMED' && new Date(other.scheduledAt).getTime() < at,
    ).length
  )
}

const ROUND_WORD = ['First', 'Second', 'Third', 'Fourth', 'Fifth']

/** "First interview", "Second interview", then "Interview, round 6". A round
 *  the company named reads "Technical interview, round 2" instead. */
export function roundTitle(round: number, label?: string): string {
  if (label) return `${label} interview, round ${round}`
  const word = ROUND_WORD[round - 1]
  return word ? `${word} interview` : `Interview, round ${round}`
}

/** The short form for a chip or an eyebrow: "Round 2 · Technical". */
export function roundName(round: number, label?: string): string {
  return label ? `Round ${round} · ${label}` : `Round ${round}`
}

/**
 * Whether a new round can be booked: nothing is open. A declined or cancelled
 * time leaves the round where it was, and a completed one moves it on.
 */
export function hasOpenInterview(interviews: Interview[]): boolean {
  return interviews.some((interview) => interview.state === 'PROPOSED' || interview.state === 'CONFIRMED')
}

/** The round a new booking will be: one past the last one completed. */
export function nextRound(interviews: Interview[]): number {
  let last = 0
  for (const interview of interviews) {
    if (interview.state === 'COMPLETED') last = Math.max(last, interview.round ?? 1)
  }
  return last + 1
}

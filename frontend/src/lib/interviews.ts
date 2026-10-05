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
  const at = new Date(interview.scheduledAt).getTime()
  return (
    1 +
    interviews.filter(
      (other) => other.state === 'CONFIRMED' && new Date(other.scheduledAt).getTime() < at,
    ).length
  )
}

const ROUND_WORD = ['First', 'Second', 'Third', 'Fourth', 'Fifth']

/** "First interview", "Second interview", then "Interview, round 6". */
export function roundTitle(round: number): string {
  const word = ROUND_WORD[round - 1]
  return word ? `${word} interview` : `Interview, round ${round}`
}

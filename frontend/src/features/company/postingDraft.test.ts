import { describe, expect, it } from 'vitest'
import type { PostingDraft } from '@/api/company'
import { blockers, dayValue, emptyDraft, endOfDay, toSave } from './postingDraft'

const NOW = new Date(2026, 9, 5, 12, 0).getTime()

function draft(changes: Partial<PostingDraft> = {}): PostingDraft {
  return {
    ...emptyDraft(),
    title: 'Backend Engineer',
    description: 'Builds the payments API.',
    city: 'Douala',
    applicationDeadline: new Date(2026, 9, 30, 23, 59, 59).toISOString(),
    ...changes,
  }
}

const texts = (found: ReturnType<typeof blockers>) => found.map((blocker) => blocker.text)

describe('blockers', () => {
  it('lets a complete posting save and publish', () => {
    expect(blockers(draft(), 'save', NOW)).toEqual([])
    expect(blockers(draft(), 'publish', NOW)).toEqual([])
  })

  it('needs a title and a description to save, since POST /jobs refuses either missing', () => {
    const found = blockers(draft({ title: '  ', description: '' }), 'save', NOW)
    expect(found.map((blocker) => blocker.step)).toEqual([1, 2])
  })

  it('saves a draft with no city and no deadline', () => {
    expect(blockers(draft({ city: '', applicationDeadline: undefined }), 'save', NOW)).toEqual([])
  })

  it('needs a city and a deadline to publish', () => {
    const found = texts(blockers(draft({ city: '', applicationDeadline: undefined }), 'publish', NOW))
    expect(found).toEqual([
      'Add a city (step 1).',
      'Choose an application deadline (step 1). The posting closes itself when it passes.',
    ])
  })

  it('publishes a remote posting with no city', () => {
    expect(blockers(draft({ city: '', workModality: 'REMOTE' }), 'publish', NOW)).toEqual([])
  })

  it('refuses to publish with a deadline already past', () => {
    const passed = new Date(2026, 9, 1, 23, 59, 59).toISOString()
    expect(texts(blockers(draft({ applicationDeadline: passed }), 'publish', NOW))).toEqual([
      'Choose a deadline that has not passed yet (step 1).',
    ])
  })
})

describe('blockers from the details and the documents', () => {
  it('refuses a shown salary with no figure, since the API does', () => {
    expect(texts(blockers(draft({ salary: { disclosed: true, currency: 'XAF', period: 'MONTH' } }), 'save', NOW))).toEqual([
      'Add a salary figure, or untick Show salary to applicants (step 2).',
    ])
  })

  it('refuses a salary that starts above where it ends', () => {
    const salary = { disclosed: true, min: 900, max: 100, currency: 'XAF', period: 'MONTH' as const }
    expect(texts(blockers(draft({ salary }), 'save', NOW))).toEqual([
      'The lower salary figure is above the upper one (step 2).',
    ])
  })

  it('lets a hidden salary through without a figure', () => {
    expect(blockers(draft({ salary: { disclosed: false } }), 'save', NOW)).toEqual([])
  })

  it('refuses an extra detail with a name and no value', () => {
    const additionalDetails = [{ label: 'Transport', value: ' ' }]
    expect(blockers(draft({ additionalDetails }), 'save', NOW).map((blocker) => blocker.step)).toEqual([2])
  })

  it('refuses a document with no name', () => {
    const documentRequirements = [
      { key: 'cv', label: 'CV', kind: 'FILE' as const, required: true },
      { key: 'custom-1', label: '  ', kind: 'FILE' as const, required: false },
    ]
    expect(texts(blockers(draft({ documentRequirements }), 'save', NOW))).toEqual([
      'Name every document, or remove it (step 3).',
    ])
  })
})

describe('toSave', () => {
  it('drops an extra detail left entirely empty and trims the rest', () => {
    const saved = toSave(
      draft({
        additionalDetails: [
          { label: '', value: '' },
          { label: ' Duration ', value: ' 6 months ' },
        ],
      }),
    )
    expect(saved.additionalDetails).toEqual([{ label: 'Duration', value: '6 months' }])
  })
})

describe('the deadline as a day', () => {
  it('stores the last second of the chosen day, which is when the posting closes', () => {
    const stored = new Date(endOfDay('2026-10-09'))
    expect([stored.getFullYear(), stored.getMonth(), stored.getDate()]).toEqual([2026, 9, 9])
    expect([stored.getHours(), stored.getMinutes(), stored.getSeconds()]).toEqual([23, 59, 59])
  })

  it('reads back as the same day it was chosen on', () => {
    expect(dayValue(new Date(endOfDay('2026-12-31')))).toBe('2026-12-31')
  })
})

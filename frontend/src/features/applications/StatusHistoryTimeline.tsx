import { APPLICATION_STATUS_LABEL } from '@/api/enums'
import type { StatusHistoryEntry } from '@/api/types'
import { Timeline } from '@/ui/Timeline'
import { formatDateTime } from '@/lib/formatDate'

export function StatusHistoryTimeline({ history }: { history: StatusHistoryEntry[] }) {
  const entries = [...history].reverse().map((entry, index) => ({
    key: `${entry.status}-${entry.timestamp}-${index}`,
    heading: APPLICATION_STATUS_LABEL[entry.status],
    timestamp: formatDateTime(entry.timestamp),
    detail: entry.note,
  }))

  return (
    <div>
      <p className="t-eyebrow" style={{ textTransform: 'uppercase', marginBottom: 'var(--space-3)' }}>
        Status history
      </p>
      <Timeline entries={entries} />
    </div>
  )
}

import { useState } from 'react'
import type { ApplicationDetail } from '@/api/types'
import { APPLICATION_STATUS_LABEL } from '@/api/enums'
import { Button } from '@/ui/Button'
import { Dialog } from '@/ui/Dialog'
import { useRespondToOffer, useWithdrawApplication } from './useApplications'

interface ApplicationActionsProps {
  application: ApplicationDetail
  onEdit: () => void
}

export function ApplicationActions({ application, onEdit }: ApplicationActionsProps) {
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const respondToOffer = useRespondToOffer(application.applicationId)
  const withdraw = useWithdrawApplication(application.applicationId)

  if (application.isFinal) {
    return (
      <p className="t-body-sm" style={{ color: 'var(--color-text-muted)' }}>
        This application is {APPLICATION_STATUS_LABEL[application.status].toLowerCase()}.
      </p>
    )
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
      {application.status === 'OFFER_EXTENDED' && (
        <>
          <Button
            variant="primary"
            loading={respondToOffer.isPending}
            onClick={() => respondToOffer.mutate('OFFER_ACCEPTED')}
          >
            Accept offer
          </Button>
          <Button
            variant="secondary"
            loading={respondToOffer.isPending}
            onClick={() => respondToOffer.mutate('OFFER_DECLINED')}
          >
            Decline offer
          </Button>
        </>
      )}

      {application.canEdit && (
        <Button variant="secondary" onClick={onEdit}>
          Edit application
        </Button>
      )}

      <Button variant="quiet" onClick={() => setWithdrawOpen(true)}>
        Withdraw application
      </Button>

      <Dialog
        open={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        title="Withdraw this application?"
        footer={
          <>
            <Button variant="quiet" onClick={() => setWithdrawOpen(false)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              loading={withdraw.isPending}
              onClick={() => withdraw.mutate(undefined, { onSuccess: () => setWithdrawOpen(false) })}
            >
              Withdraw application
            </Button>
          </>
        }
      >
        <p className="t-body-sm">The recruiter will be told, and this cannot be undone.</p>
      </Dialog>
    </div>
  )
}

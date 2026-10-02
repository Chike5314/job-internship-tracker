import { useState } from 'react'
import { createLogoUploadUrl } from '@/api/company'
import { putToPresignedUrl, resolveContentType } from '@/api/uploads'
import { FileDrop, type FileDropStatus } from '@/ui/FileDrop'
import { Icon } from '@/ui/Icon'
import { useToast } from '@/ui/ToastProvider'
import { useUpdateCompany } from './useCompany'
import styles from './CompanyLogoCard.module.css'

/**
 * Three steps, like every other upload here: ask for a URL, PUT the file
 * straight to S3, then record the key on the company. Nothing is recorded until
 * the third call, so an abandoned upload leaves the company exactly as it was.
 *
 * Optional throughout. A company with no logo shows its initial, which is a
 * deliberate placeholder rather than a gap waiting to be filled.
 */
export function CompanyLogoCard({
  companyName,
  logoUrl,
}: {
  companyName: string
  logoUrl?: string
}) {
  const [status, setStatus] = useState<FileDropStatus>({ kind: 'idle' })
  const update = useUpdateCompany()
  const { showToast } = useToast()

  async function onSelect(file: File) {
    setStatus({ kind: 'uploading', fileName: file.name, progress: 0 })
    try {
      const contentType = resolveContentType(file)
      const upload = await createLogoUploadUrl({
        fileName: file.name,
        contentType,
        fileSize: file.size,
      })
      await putToPresignedUrl(upload.uploadUrl, file, contentType)
      await update.mutateAsync({ logoS3Key: upload.s3Key })
      setStatus({ kind: 'done', fileName: file.name })
      showToast('Logo saved.')
    } catch {
      setStatus({
        kind: 'failed',
        fileName: file.name,
        message: 'That upload did not finish. Try again.',
      })
    }
  }

  return (
    <section className={['glass-dense', styles.card].join(' ')}>
      <div className={styles.preview}>
        {logoUrl ? (
          <img src={logoUrl} alt={`${companyName} logo`} className={styles.logo} />
        ) : (
          <span className={styles.placeholder} aria-hidden="true">
            {companyName.trim().charAt(0).toUpperCase() || '?'}
          </span>
        )}
      </div>

      <div className={styles.body}>
        <p className="t-heading-sm">Company logo</p>
        <p className={['t-body-sm', styles.muted].join(' ')}>
          Optional. It appears beside your postings and in the applicant's list. Square works best,
          and anything above about 200px is enough.
        </p>
        <FileDrop
          accept=".png,.jpg,.jpeg"
          help="PNG or JPG, up to 10 MB."
          status={status}
          onSelect={onSelect}
        />
        {logoUrl && (
          <p className={['t-caption', styles.muted].join(' ')}>
            <Icon name="info" size={14} /> Uploading a new one replaces what applicants see. The
            file behind the old one is kept, as every upload here is.
          </p>
        )}
      </div>
    </section>
  )
}

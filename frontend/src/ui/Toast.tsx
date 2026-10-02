import styles from './Toast.module.css'

export interface ToastData {
  id: string
  message: string
  tone: 'neutral' | 'error'
}

export function Toast({ toast, onDismiss }: { toast: ToastData; onDismiss: (id: string) => void }) {
  return (
    <div
      className={[styles.toast, toast.tone === 'error' && styles.error].filter(Boolean).join(' ')}
      role={toast.tone === 'error' ? 'alert' : 'status'}
    >
      <p className="t-body-sm">{toast.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss"
        className={styles.dismiss}
      >
        &times;
      </button>
    </div>
  )
}

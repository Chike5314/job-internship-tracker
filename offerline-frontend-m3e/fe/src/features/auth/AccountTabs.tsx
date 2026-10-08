import { useSearchParams } from 'react-router-dom'
import styles from './authPanel.module.css'

export type Account = 'applicant' | 'company'

/** The account kind lives in the query, so a link can open either side of the
 *  screen directly and a reload keeps the viewer where they were. */
export function useAccount(): [Account, (next: Account) => void] {
  const [params, setParams] = useSearchParams()
  const account: Account = params.get('account') === 'company' ? 'company' : 'applicant'

  function set(next: Account) {
    const updated = new URLSearchParams(params)
    if (next === 'company') updated.set('account', 'company')
    else updated.delete('account')
    setParams(updated, { replace: true })
  }

  return [account, set]
}

/**
 * The two kinds of account, named by what the person is here to do rather than
 * by the role the system files them under.
 */
export function AccountTabs({
  account,
  onChange,
}: {
  account: Account
  onChange: (next: Account) => void
}) {
  return (
    <div className={['glass-soft', styles.tabs].join(' ')} role="tablist" aria-label="Account type">
      <button
        type="button"
        role="tab"
        aria-selected={account === 'applicant'}
        className={[styles.tab, account === 'applicant' ? styles.tabActive : ''].join(' ')}
        onClick={() => onChange('applicant')}
      >
        I'm looking for work
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={account === 'company'}
        className={[styles.tab, account === 'company' ? styles.tabActive : ''].join(' ')}
        onClick={() => onChange('company')}
      >
        I'm hiring
      </button>
    </div>
  )
}

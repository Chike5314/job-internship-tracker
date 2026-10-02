import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Identity } from '@/auth/authApi'
import { useAuth } from '@/auth/AuthProvider'
import { Flyout } from '@/ui/Flyout'
import styles from './AccountMenu.module.css'

export function AccountMenu({ identity }: { identity: Identity }) {
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLDivElement>(null)
  const { signOut } = useAuth()
  const navigate = useNavigate()

  return (
    <div className={styles.wrapper} ref={anchorRef}>
      <button type="button" className={[styles.trigger, 't-body-sm'].join(' ')} onClick={() => setOpen((v) => !v)}>
        {identity.fullName || identity.email}
      </button>
      <Flyout open={open} onClose={() => setOpen(false)} anchorRef={anchorRef} title="Account">
        <nav className={styles.menu}>
          <Link to="/profile/cvs" onClick={() => setOpen(false)} className="t-body-sm">
            CVs
          </Link>
          <button
            type="button"
            className="t-body-sm"
            onClick={async () => {
              setOpen(false)
              await signOut()
              navigate('/')
            }}
          >
            Sign out
          </button>
        </nav>
      </Flyout>
    </div>
  )
}

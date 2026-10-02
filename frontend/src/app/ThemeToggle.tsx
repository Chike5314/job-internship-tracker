import { useTheme, type ThemePreference } from './ThemeProvider'
import { Icon, type IconName } from '@/ui/Icon'
import styles from './ThemeToggle.module.css'

const ORDER: ThemePreference[] = ['paper', 'ink', 'system']

const LABEL: Record<ThemePreference, string> = {
  paper: 'Paper theme',
  ink: 'Ink theme',
  system: 'Matching your system',
}

const ICON: Record<ThemePreference, IconName> = {
  paper: 'theme-paper',
  ink: 'theme-ink',
  system: 'theme-system',
}

export function ThemeToggle() {
  const { preference, setPreference } = useTheme()

  function cycle() {
    const next = ORDER[(ORDER.indexOf(preference) + 1) % ORDER.length]!
    setPreference(next)
  }

  return (
    <button
      type="button"
      onClick={cycle}
      className={styles.toggle}
      aria-label={`Theme: ${LABEL[preference]}. Activate to switch.`}
    >
      <Icon name={ICON[preference]} size={18} />
    </button>
  )
}

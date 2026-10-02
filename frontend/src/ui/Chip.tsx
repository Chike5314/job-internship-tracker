import type { ButtonHTMLAttributes } from 'react'
import styles from './Chip.module.css'

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean
}

/** A toggleable filter chip, e.g. the opportunity type / modality filters. */
export function Chip({ selected = false, className, ...rest }: ChipProps) {
  return (
    <button
      type="button"
      className={[styles.chip, selected && styles.selected, 't-body-sm', className]
        .filter(Boolean)
        .join(' ')}
      aria-pressed={selected}
      {...rest}
    />
  )
}

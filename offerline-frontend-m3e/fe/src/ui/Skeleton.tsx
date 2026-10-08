import type { CSSProperties } from 'react'
import styles from './Skeleton.module.css'

interface SkeletonProps {
  width?: string | number
  height?: string | number
  radius?: string
}

export function Skeleton({ width = '100%', height = '1em', radius = 'var(--m3-shape-md)' }: SkeletonProps) {
  const style: CSSProperties = { width, height, borderRadius: radius }
  return <span className={styles.skeleton} style={style} aria-hidden="true" />
}

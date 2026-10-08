import { useEffect, useRef } from 'react'

/** Calls `onSettle` with `value` after `delayMs` of no further changes. */
export function useDebouncedValue<T>(value: T, delayMs: number, onSettle: (value: T) => void) {
  const onSettleRef = useRef(onSettle)

  // Keeps the ref pointing at the latest callback without putting
  // `onSettle` (a new function identity most renders) into the timer
  // effect's own dependency array, and without mutating the ref during
  // render, which is an unsafe time to touch it.
  useEffect(() => {
    onSettleRef.current = onSettle
  }, [onSettle])

  useEffect(() => {
    const timer = setTimeout(() => onSettleRef.current(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])
}

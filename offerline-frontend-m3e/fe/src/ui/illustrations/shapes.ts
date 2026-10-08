/**
 * Scalloped "cookie" outline, one of the Material 3 Expressive shape family.
 * n lobes, amp is how far each lobe swings in and out of the base radius.
 */
export function scallopPath(cx: number, cy: number, r: number, n: number, amp: number): string {
  const steps = n * 24
  const points: string[] = []
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * Math.PI * 2
    const radius = r + amp * Math.sin(angle * n)
    const x = cx + radius * Math.cos(angle)
    const y = cy + radius * Math.sin(angle)
    points.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`)
  }
  return `${points.join(' ')} Z`
}

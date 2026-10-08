import type { SVGProps } from 'react'
import { scallopPath } from './shapes'

/**
 * Original illustrations, drawn as SVG so they recolour with the theme: every
 * fill is a token, so paper and ink both get a correct version from one file.
 * They are decoration. Each is aria-hidden; the heading beside it says what the
 * screen is.
 */
type Art = SVGProps<SVGSVGElement>

const card = 'var(--color-glass-solid)'
const edge = 'var(--m3-outline-variant)'
const forest = 'var(--color-forest-500)'
const forestSoft = 'var(--m3-primary-container)'
const verm = 'var(--color-verm-500)'
const vermSoft = 'var(--m3-tertiary-container)'
const ink = 'var(--color-text-primary)'
const faint = 'var(--color-rule-hairline)'

function Svg({ viewBox, children, ...rest }: Art & { viewBox: string }) {
  return (
    <svg viewBox={viewBox} fill="none" aria-hidden="true" focusable="false" {...rest}>
      {children}
    </svg>
  )
}

const Check = ({ x, y, r = 14, fill = forest }: { x: number; y: number; r?: number; fill?: string }) => (
  <g>
    <circle cx={x} cy={y} r={r} fill={fill} />
    <path
      d={`M${x - r * 0.42} ${y + r * 0.02} l${r * 0.3} ${r * 0.32} l${r * 0.55} ${-r * 0.62}`}
      stroke="#fff"
      strokeWidth={r * 0.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </g>
)

/**
 * A verified company, and an application on its way to an offer.
 * `backdrop` draws only the blob and the floating shapes, for when the
 * product's own UI is sitting on top and the cards would just be hidden.
 */
export function HeroScene({ backdrop = false, ...props }: Art & { backdrop?: boolean }) {
  return (
    <Svg viewBox="0 0 480 440" {...props}>
      <path d={scallopPath(240, 222, 196, 10, 9)} fill={forestSoft} opacity="0.9" />
      <path d={scallopPath(414, 66, 34, 8, 4)} fill={vermSoft} />
      <circle cx="54" cy="372" r="16" fill={vermSoft} />
      <circle cx="446" cy="330" r="9" fill={forest} opacity="0.55" />
      {backdrop && (
        <>
          <path d={scallopPath(64, 96, 26, 8, 3)} fill={forest} opacity="0.35" />
          <path d={scallopPath(420, 396, 22, 8, 3)} fill={verm} opacity="0.4" />
        </>
      )}
      {!backdrop && (
      <>
      {/* Back card: the verified company */}
      <g transform="translate(62 62)">
        <rect width="236" height="152" rx="28" fill={card} stroke={edge} />
        <rect x="24" y="26" width="52" height="52" rx="16" fill={forestSoft} />
        <rect x="38" y="40" width="10" height="24" rx="2" fill={forest} />
        <rect x="52" y="34" width="10" height="30" rx="2" fill={forest} opacity="0.7" />
        <rect x="90" y="32" width="96" height="12" rx="6" fill={ink} opacity="0.85" />
        <rect x="90" y="54" width="64" height="9" rx="4.5" fill={faint} />
        <rect x="24" y="100" width="188" height="10" rx="5" fill={faint} />
        <rect x="24" y="120" width="120" height="10" rx="5" fill={faint} />
        <Check x={214} y={8} r={19} />
      </g>

      {/* Front card: the application */}
      <g transform="translate(150 186)" className="m3-float">
        <rect width="262" height="188" rx="30" fill={card} stroke={edge} />
        <circle cx="46" cy="46" r="22" fill={vermSoft} />
        <path d="M46 36a9 9 0 1 1 0 18a9 9 0 0 1 0-18zm-16 36c3-9 10-12 16-12s13 3 16 12" fill={verm} opacity="0.8" />
        <rect x="82" y="30" width="104" height="12" rx="6" fill={ink} opacity="0.85" />
        <rect x="82" y="52" width="70" height="9" rx="4.5" fill={faint} />
        <rect x="190" y="26" width="58" height="26" rx="13" fill={forest} />
        <rect x="203" y="35" width="32" height="8" rx="4" fill="#fff" opacity="0.9" />

        {/* The pipeline */}
        <line x1="42" y1="132" x2="220" y2="132" stroke={faint} strokeWidth="4" strokeLinecap="round" />
        <line x1="42" y1="132" x2="170" y2="132" stroke={forest} strokeWidth="4" strokeLinecap="round" />
        <circle cx="42" cy="132" r="9" fill={forest} />
        <circle cx="98" cy="132" r="9" fill={forest} />
        <circle cx="154" cy="132" r="9" fill={forest} />
        <circle cx="220" cy="132" r="13" fill={card} stroke={verm} strokeWidth="3" />
        <path d="M214 132l4 4 8-9" stroke={verm} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="30" y="156" width="46" height="8" rx="4" fill={faint} />
        <rect x="190" y="156" width="60" height="8" rx="4" fill={vermSoft} />
      </g>
      </>
      )}
    </Svg>
  )
}

/** The company side of the landing page: postings, a pipeline and an interview. */
export function CompanyScene(props: Art) {
  const col = (x: number, tone: string, rows: number) => (
    <g transform={`translate(${x} 0)`}>
      <rect width="86" height="14" rx="7" fill={tone} />
      {Array.from({ length: rows }).map((_, i) => (
        <g key={i} transform={`translate(0 ${26 + i * 46})`}>
          <rect width="86" height="38" rx="12" fill={card} stroke={edge} />
          <circle cx="16" cy="19" r="8" fill={forestSoft} />
          <rect x="30" y="12" width="44" height="6" rx="3" fill={ink} opacity="0.7" />
          <rect x="30" y="23" width="30" height="5" rx="2.5" fill={faint} />
        </g>
      ))}
    </g>
  )
  return (
    <Svg viewBox="0 0 440 320" {...props}>
      <path d={scallopPath(220, 160, 148, 9, 8)} fill={forestSoft} opacity="0.85" />
      <g transform="translate(60 52)">
        <rect x="-14" y="-14" width="334" height="216" rx="32" fill={card} stroke={edge} />
        <g transform="translate(14 16)">
          {col(0, forest, 3)}
          {col(100, 'var(--color-forest-300)', 2)}
          {col(200, verm, 1)}
        </g>
      </g>
      <g transform="translate(290 196)" className="m3-float">
        <rect width="118" height="94" rx="24" fill={card} stroke={edge} />
        <rect x="14" y="14" width="90" height="22" rx="11" fill={vermSoft} />
        <rect x="26" y="22" width="40" height="6" rx="3" fill={verm} />
        <g fill={faint}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <circle key={i} cx={22 + (i % 3) * 38} cy={54 + Math.floor(i / 3) * 24} r="5" />
          ))}
        </g>
        <circle cx="60" cy="54" r="9" fill={verm} />
      </g>
      <Check x={72} y={274} r={18} />
    </Svg>
  )
}

/**
 * The sign-in panel. This sits on the forest ground in both themes, so its
 * colours are fixed rather than tokenised.
 */
export function AuthScene(props: Art) {
  const nodes = [
    { x: 54, y: 224, r: 22, fill: '#a3c6b2' },
    { x: 150, y: 150, r: 22, fill: '#cfe2d7' },
    { x: 262, y: 168, r: 22, fill: '#6fa488' },
    { x: 360, y: 84, r: 30, fill: '#ee8c68' },
  ]
  return (
    <Svg viewBox="0 0 420 280" {...props}>
      <path
        d="M54 224 C 100 224, 100 150, 150 150 S 218 168, 262 168 S 330 84, 360 84"
        stroke="#ffffff"
        strokeOpacity="0.28"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="2 12"
      />
      <path d={scallopPath(360, 84, 56, 8, 5)} fill="#ee8c68" opacity="0.2" />
      {nodes.map((n, i) => (
        <g key={i}>
          <path d={scallopPath(n.x, n.y, n.r, 8, 2.4)} fill={n.fill} />
        </g>
      ))}
      <path d="M347 85l9 9 17-19" stroke="#6b1f0d" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="40" y="214" width="28" height="4" rx="2" fill="#123425" opacity="0.7" />
      <rect x="40" y="224" width="20" height="4" rx="2" fill="#123425" opacity="0.5" />
      <circle cx="150" cy="150" r="7" fill="#123425" opacity="0.65" />
      <path d="M255 168h14M262 161v14" stroke="#123425" strokeWidth="3.5" strokeLinecap="round" opacity="0.7" />
    </Svg>
  )
}

export function EmptySearchArt(props: Art) {
  return (
    <Svg viewBox="0 0 200 160" {...props}>
      <path d={scallopPath(100, 82, 66, 9, 4)} fill={forestSoft} />
      <rect x="40" y="40" width="82" height="22" rx="11" fill={card} stroke={edge} />
      <rect x="52" y="48" width="38" height="6" rx="3" fill={faint} />
      <rect x="52" y="70" width="82" height="22" rx="11" fill={card} stroke={edge} />
      <rect x="64" y="78" width="46" height="6" rx="3" fill={faint} />
      <circle cx="132" cy="96" r="26" fill={card} stroke={forest} strokeWidth="6" />
      <path d="M152 116l22 22" stroke={forest} strokeWidth="8" strokeLinecap="round" />
      <path d="M122 96h20" stroke={verm} strokeWidth="4" strokeLinecap="round" />
      <circle cx="42" cy="124" r="6" fill={vermSoft} />
    </Svg>
  )
}

export function EmptyInboxArt(props: Art) {
  return (
    <Svg viewBox="0 0 200 160" {...props}>
      <path d={scallopPath(100, 84, 64, 8, 4)} fill={forestSoft} />
      <rect x="44" y="64" width="112" height="70" rx="18" fill={card} stroke={edge} />
      <path d="M52 76l48 34l48-34" stroke={forest} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <g className="m3-float">
        <circle cx="146" cy="52" r="24" fill={vermSoft} />
        <path d="M146 39a11 11 0 0 0-11 11v9l-4 5h30l-4-5v-9a11 11 0 0 0-11-11z" fill={verm} />
        <circle cx="146" cy="70" r="3.4" fill={verm} />
      </g>
    </Svg>
  )
}

export function EmptyDocsArt(props: Art) {
  return (
    <Svg viewBox="0 0 200 160" {...props}>
      <path d={scallopPath(100, 82, 66, 10, 4)} fill={forestSoft} />
      <g transform="rotate(-8 80 90)">
        <rect x="46" y="38" width="70" height="92" rx="14" fill={card} stroke={edge} />
        <rect x="58" y="54" width="30" height="7" rx="3.5" fill={ink} opacity="0.6" />
        <rect x="58" y="70" width="46" height="6" rx="3" fill={faint} />
        <rect x="58" y="84" width="40" height="6" rx="3" fill={faint} />
      </g>
      <g transform="rotate(7 126 92)">
        <rect x="90" y="46" width="70" height="92" rx="14" fill={card} stroke={forest} strokeWidth="2.5" />
        <circle cx="112" cy="70" r="9" fill={vermSoft} />
        <rect x="104" y="92" width="46" height="6" rx="3" fill={faint} />
        <rect x="104" y="106" width="34" height="6" rx="3" fill={faint} />
        <path d="M150 38v22a7 7 0 0 1-14 0V42" stroke={verm} strokeWidth="4" strokeLinecap="round" />
      </g>
    </Svg>
  )
}

export function LostArt(props: Art) {
  return (
    <Svg viewBox="0 0 200 160" {...props}>
      <path d={scallopPath(100, 84, 66, 9, 4)} fill={forestSoft} />
      <rect x="96" y="40" width="9" height="96" rx="4.5" fill={ink} opacity="0.55" />
      <path d="M52 52h58l14 12l-14 12H52a8 8 0 0 1-8-8V60a8 8 0 0 1 8-8z" fill={forest} />
      <path d="M148 86H98l-14 12l14 12h50a8 8 0 0 0 8-8V94a8 8 0 0 0-8-8z" fill={verm} />
      <rect x="56" y="60" width="38" height="6" rx="3" fill="#fff" opacity="0.85" />
      <rect x="104" y="94" width="38" height="6" rx="3" fill="#fff" opacity="0.85" />
      <ellipse cx="100" cy="138" rx="30" ry="5" fill={ink} opacity="0.12" />
    </Svg>
  )
}

export type EmptyArt = 'search' | 'inbox' | 'docs' | 'lost' | 'company'

export function EmptyIllustration({ art, ...rest }: Art & { art: EmptyArt }) {
  switch (art) {
    case 'inbox':
      return <EmptyInboxArt {...rest} />
    case 'docs':
      return <EmptyDocsArt {...rest} />
    case 'lost':
      return <LostArt {...rest} />
    case 'company':
      return <CompanyScene {...rest} />
    default:
      return <EmptySearchArt {...rest} />
  }
}

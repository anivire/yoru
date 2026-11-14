import type { CSSProperties } from 'react'
import { cn } from '../lib/cn'

export type MascotMood = 'idle' | 'happy' | 'sleepy' | 'thinking' | 'error'

const BODY_FILL = 'var(--logo)'
const INK = 'var(--logo-ink)'
const SQUARE = 'matrix(1.14 0 0 0.9 -4.48 3.4)'
const MARK_BODY = 'M32 11C44.2 11 53 20 53 32V51.5C53 55.6 48.6 57.7 45.6 55L42 51.8L36.4 56.4C33.8 58.5 30.2 58.5 27.6 56.4L22 51.8L18.4 55C15.4 57.7 11 55.6 11 51.5V32C11 20 19.8 11 32 11Z'

function twinkle(animated: boolean, delay = 0): CSSProperties | undefined {
  return animated ? { animation: `yoru-twinkle 1.8s ease-in-out ${delay}s infinite` } : undefined
}

function Ears({ droop }: { droop: boolean }) {
  return (
    <g fill={BODY_FILL} stroke={BODY_FILL} strokeWidth={4} strokeLinejoin="round">
      <path d="M15 25L16.5 7.5L29 14Z" transform={droop ? 'translate(0 3) rotate(-18 21 22)' : undefined} />
      <path d="M49 25L47.5 7.5L35 14Z" transform={droop ? 'translate(0 3) rotate(18 43 22)' : undefined} />
    </g>
  )
}

function Sparkle({ x, y, r, style }: { x: number; y: number; r: number; style?: CSSProperties }) {
  return (
    <path
      d={`M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z`}
      fill={BODY_FILL}
      style={style}
    />
  )
}

function PillEyes({ dx = 0, dy = 0, height = 12, blink = false }: { dx?: number; dy?: number; height?: number; blink?: boolean }) {
  const y = 33 - height / 2 + dy
  return (
    <g fill={INK} style={blink ? { transformOrigin: '32px 33px', animation: 'yoru-blink 5s infinite' } : undefined}>
      <rect x={20.5 + dx} y={y} width={7} height={height} rx={3.5} />
      <rect x={36.5 + dx} y={y} width={7} height={height} rx={3.5} />
    </g>
  )
}

function Face({ mood }: { mood: MascotMood }) {
  switch (mood) {
    case 'happy':
      return (
        <g fill="none" stroke={INK} strokeWidth={3.6} strokeLinecap="round">
          <path d="M20 35Q24 28 28 35" />
          <path d="M36 35Q40 28 44 35" />
        </g>
      )
    case 'sleepy':
      return (
        <g fill="none" stroke={INK} strokeWidth={3.6} strokeLinecap="round">
          <path d="M20 32Q24 37 28 32" />
          <path d="M36 32Q40 37 44 32" />
        </g>
      )
    case 'thinking':
      return <PillEyes dx={1.8} dy={-2} height={10} />
    case 'error':
      return (
        <g fill="none" stroke={INK} strokeWidth={3.4} strokeLinecap="round">
          <path d="M20.5 28.5L27.5 35.5M27.5 28.5L20.5 35.5" />
          <path d="M36.5 28.5L43.5 35.5M43.5 28.5L36.5 35.5" />
        </g>
      )
    default:
      return <PillEyes blink />
  }
}

function Extras({ mood, animated }: { mood: MascotMood; animated: boolean }) {
  switch (mood) {
    case 'happy':
      return (
        <>
          <Sparkle x={57.5} y={15} r={4.5} style={twinkle(animated)} />
          <Sparkle x={5.5} y={27} r={3} style={twinkle(animated, 0.9)} />
        </>
      )
    case 'sleepy':
      return (
        <g fill="none" stroke={BODY_FILL} strokeLinecap="round" strokeLinejoin="round">
          <path d="M54 1.5H61L54 9H61" strokeWidth={2.6} style={twinkle(animated, 0.6)} />
          <path d="M47.5 8H52L47.5 12.5H52" strokeWidth={2.2} style={twinkle(animated)} />
        </g>
      )
    case 'thinking':
      return (
        <g fill={BODY_FILL}>
          <circle cx={54.5} cy={19.5} r={1.8} style={twinkle(animated)} />
          <circle cx={57.2} cy={13.4} r={2.4} style={twinkle(animated, 0.3)} />
          <circle cx={59.2} cy={5.8} r={3.1} style={twinkle(animated, 0.6)} />
        </g>
      )
    default:
      return null
  }
}

export function Mascot({
  mood = 'idle',
  size = 32,
  className,
  animated = true,
}: {
  mood?: MascotMood
  size?: number
  className?: string
  animated?: boolean
}) {
  const droop = mood === 'sleepy' || mood === 'error'
  return (
    <svg
      width={`${size / 16}rem`}
      height={`${size / 16}rem`}
      viewBox="0 0 64 64"
      className={cn('shrink-0 overflow-visible', className)}
      style={animated && mood !== 'sleepy' ? { animation: 'yoru-bob 3.2s ease-in-out infinite' } : undefined}
      aria-hidden
    >
      <g transform={SQUARE}>
        <Ears droop={droop} />
        <path d={MARK_BODY} fill={BODY_FILL} />
      </g>
      <Face mood={mood} />
      <Extras mood={mood} animated={animated} />
    </svg>
  )
}

export function logoSvg(body: string, ink: string): string {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">',
    `<g fill="${body}" stroke="${body}" stroke-width="4" stroke-linejoin="round"><path d="M15 25L16.5 7.5L29 14Z"/><path d="M49 25L47.5 7.5L35 14Z"/></g>`,
    `<path fill="${body}" d="${MARK_BODY}"/>`,
    `<g fill="${ink}"><rect x="20.5" y="27" width="7" height="12" rx="3.5"/><rect x="36.5" y="27" width="7" height="12" rx="3.5"/></g>`,
    '</svg>',
  ].join('')
}

export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={`${size / 16}rem`} height={`${size / 16}rem`} viewBox="0 0 64 64" className={cn('shrink-0', className)} aria-hidden>
      <g transform={SQUARE}>
        <g fill="var(--logo)" stroke="var(--logo)" strokeWidth={4} strokeLinejoin="round">
          <path d="M15 25L16.5 7.5L29 14Z" />
          <path d="M49 25L47.5 7.5L35 14Z" />
        </g>
        <path d={MARK_BODY} fill="var(--logo)" />
      </g>
      <g fill="var(--logo-ink)">
        <rect x={20.5} y={27} width={7} height={12} rx={3.5} />
        <rect x={36.5} y={27} width={7} height={12} rx={3.5} />
      </g>
    </svg>
  )
}

export function Logo({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      <LogoMark size={size} />
      <span className="text-[1.0625rem] font-semibold tracking-tight">yoru</span>
    </span>
  )
}

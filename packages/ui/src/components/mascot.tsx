import type { CSSProperties } from 'react'
import { cn } from '../lib/cn'

export type MascotMood = 'idle' | 'happy' | 'sleepy' | 'thinking' | 'error'

const FACE = 'oklch(0.2 0.03 var(--hue))'
const SHINE = 'oklch(1 0 0 / 0.92)'
const BLUSH = 'oklch(0.9 0.1 calc(var(--hue) + 40) / 0.45)'
const TONGUE = 'oklch(0.74 0.15 18)'

const BODY =
  'M32 11C43.6 11 53 20.4 53 32V50C53 54.5 50.5 58 46 58C41.8 58 40.2 52 39 52C37.8 52 36.2 58 32 58C27.8 58 26.2 52 25 52C23.8 52 22.2 58 18 58C13.5 58 11 54.5 11 50V32C11 20.4 20.4 11 32 11Z'

function twinkle(animated: boolean, delay = 0): CSSProperties | undefined {
  return animated ? { animation: `yoru-twinkle 1.8s ease-in-out ${delay}s infinite` } : undefined
}

function Ear({ droop }: { droop: boolean }) {
  return (
    <>
      <path d={droop ? 'M13.5 24L7.1 15.2L20 16.5Z' : 'M16 18.5L17.5 7L28.5 12.5Z'} fill="var(--accent)" stroke="var(--accent)" strokeWidth={3} strokeLinejoin="round" />
      <path d={droop ? 'M13.5 21L10.6 17.1L16.4 17.7Z' : 'M18.6 15.3L19.3 10.1L24.2 12.6Z'} fill={BLUSH} stroke={BLUSH} strokeWidth={1} strokeLinejoin="round" />
    </>
  )
}

function Sparkle({ x, y, r, style }: { x: number; y: number; r: number; style?: CSSProperties }) {
  return (
    <path
      d={`M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z`}
      fill="var(--accent)"
      style={style}
    />
  )
}

function OpenEyes({ dx = 0, dy = 0, blink = false }: { dx?: number; dy?: number; blink?: boolean }) {
  return (
    <g style={blink ? { transformOrigin: '32px 32px', animation: 'yoru-blink 5s infinite' } : undefined}>
      <g fill={FACE}>
        <ellipse cx={24 + dx} cy={32 + dy} rx={3.5} ry={4.8} />
        <ellipse cx={40 + dx} cy={32 + dy} rx={3.5} ry={4.8} />
      </g>
      <g fill={SHINE}>
        <circle cx={25.1 + dx} cy={30.2 + dy} r={1.2} />
        <circle cx={41.1 + dx} cy={30.2 + dy} r={1.2} />
      </g>
    </g>
  )
}

function Face({ mood }: { mood: MascotMood }) {
  switch (mood) {
    case 'happy':
      return (
        <>
          <g fill="none" stroke={FACE} strokeWidth={2.6} strokeLinecap="round">
            <path d="M20.5 33.5Q24 28 27.5 33.5" />
            <path d="M36.5 33.5Q40 28 43.5 33.5" />
          </g>
          <path d="M27.5 37H36.5C36.5 40 34.5 42 32 42S27.5 40 27.5 37Z" fill={FACE} stroke={FACE} strokeWidth={1} strokeLinejoin="round" />
          <path d="M29.8 40.6Q32 39 34.2 40.6Q32 42.6 29.8 40.6Z" fill={TONGUE} />
        </>
      )
    case 'sleepy':
      return (
        <>
          <g fill="none" stroke={FACE} strokeWidth={2.6} strokeLinecap="round">
            <path d="M20.5 32Q24 35.5 27.5 32" />
            <path d="M36.5 32Q40 35.5 43.5 32" />
          </g>
          <ellipse cx={32} cy={39.6} rx={1.7} ry={2} fill={FACE} />
        </>
      )
    case 'thinking':
      return (
        <>
          <OpenEyes dx={1.6} dy={-1.6} />
          <g fill="none" stroke={FACE} strokeLinecap="round">
            <path d="M38 23.6Q41.6 21.6 45 23.8" strokeWidth={1.8} />
            <path d="M31 40L35.2 39.2" strokeWidth={2} />
          </g>
        </>
      )
    case 'error':
      return (
        <>
          <g fill="none" stroke={FACE} strokeWidth={2.6} strokeLinecap="round">
            <path d="M21 29L27 35M27 29L21 35" />
            <path d="M37 29L43 35M43 29L37 35" />
          </g>
          <path d="M26.5 41Q28.3 38.6 30.2 41T33.8 41T37.5 41" fill="none" stroke={FACE} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )
    default:
      return (
        <>
          <OpenEyes blink />
          <path d="M28.6 38.4Q30.3 41 32 38.4Q33.7 41 35.4 38.4" fill="none" stroke={FACE} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )
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
        <g fill="none" stroke="var(--accent)" strokeLinecap="round" strokeLinejoin="round">
          <path d="M55 1.5H61L55 8H61" strokeWidth={2} style={twinkle(animated, 0.6)} />
          <path d="M48.5 7.5H52.3L48.5 11.5H52.3" strokeWidth={1.6} style={twinkle(animated)} />
        </g>
      )
    case 'thinking':
      return (
        <g fill="var(--accent)">
          <circle cx={54.5} cy={19.5} r={1.5} style={twinkle(animated)} />
          <circle cx={57.2} cy={13.6} r={2.1} style={twinkle(animated, 0.3)} />
          <circle cx={59.2} cy={6.2} r={2.8} style={twinkle(animated, 0.6)} />
        </g>
      )
    case 'error':
      return <path d="M47 20.5C48.9 23 50 24.6 50 26A3 3 0 0 1 44 26C44 24.6 45.1 23 47 20.5Z" fill={SHINE} opacity={0.75} />
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
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={cn('shrink-0 overflow-visible', className)}
      style={animated && mood !== 'sleepy' ? { animation: 'yoru-bob 3.2s ease-in-out infinite' } : undefined}
      aria-hidden
    >
      <Ear droop={droop} />
      <g transform="matrix(-1 0 0 1 64 0)">
        <Ear droop={droop} />
      </g>
      <path d={BODY} fill="var(--accent)" />
      <g fill={BLUSH}>
        <ellipse cx={17.6} cy={38.6} rx={3.2} ry={2} />
        <ellipse cx={46.4} cy={38.6} rx={3.2} ry={2} />
      </g>
      <Face mood={mood} />
      <Extras mood={mood} animated={animated} />
    </svg>
  )
}

export function Logo({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <Mascot size={size} animated={false} />
      <span className="text-[17px] font-semibold tracking-tight">yoru</span>
    </span>
  )
}

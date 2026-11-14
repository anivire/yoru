import { type ColorScheme, THEME_PRESETS, cn } from '@yoru/ui'
import { RiCheckFill, RiMoonFill, RiSunFill } from '@remixicon/react'
import { useTranslation } from 'react-i18next'
import { useAppearance } from '../lib/appearance'

function SchemePreview({ scheme }: { scheme: 'light' | 'dark' }) {
  return (
    <div className={cn(scheme, 'flex h-full w-full flex-col gap-[6%] bg-background p-[5%]')}>
      <div className="flex h-[8%] items-center gap-[3%]">
        <div className="aspect-square h-full rounded-full bg-accent" />
        <div className="h-[70%] w-[12%] rounded-full bg-foreground/70" />
        <div className="mx-auto flex h-full w-[36%] items-center gap-[8%]">
          <div className="h-full flex-1 rounded-full bg-muted" />
          <div className="h-[60%] flex-1 rounded-full bg-muted-foreground/30" />
          <div className="h-[60%] flex-1 rounded-full bg-muted-foreground/30" />
        </div>
        <div className="aspect-square h-full rounded-full bg-field" />
        <div className="aspect-square h-full rounded-full bg-field" />
      </div>
      <div
        className="flex h-[34%] flex-col justify-center gap-[10%] rounded-[0.375rem] bg-surface px-[5%]"
        style={{ backgroundImage: 'radial-gradient(circle at 85% 40%, var(--accent-soft), transparent 55%)' }}
      >
        <div className="h-[14%] w-[45%] rounded-full bg-foreground/80" />
        <div className="h-[9%] w-[30%] rounded-full bg-muted-foreground/40" />
        <div className="h-[20%] w-[18%] rounded-full bg-accent" />
      </div>
      <div className="grid flex-1 grid-cols-5 gap-[3%]">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex flex-col gap-[8%]">
            <div className={cn('flex-1 rounded-[0.25rem]', i === 1 ? 'bg-accent-soft' : 'bg-muted')} />
            <div className="h-[10%] w-4/5 rounded-full bg-muted-foreground/30" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function SchemePicker({ compact }: { compact?: boolean }) {
  const { t } = useTranslation()
  const { scheme, setScheme } = useAppearance()
  const options: { value: ColorScheme; label: string }[] = [
    { value: 'system', label: t('settings.system') },
    { value: 'light', label: t('settings.light') },
    { value: 'dark', label: t('settings.dark') },
  ]
  return (
    <div className={cn('grid', compact ? 'grid-cols-3 gap-2' : 'grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-4')}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => setScheme(o.value)}
          className={cn(
            'group cursor-pointer rounded-xl p-1.5 text-center transition-colors',
            !compact && 'flex items-center gap-3 text-left sm:block sm:text-center',
            scheme === o.value ? 'bg-accent-soft' : 'bg-surface hover:bg-field',
          )}
        >
          <div className={cn('overflow-hidden rounded-lg', compact ? 'h-24' : 'h-32 w-28 shrink-0 sm:h-64 sm:w-auto')}>
            {o.value === 'system' ? (
              <div className="relative h-full w-full">
                <div className="absolute inset-0 [clip-path:inset(0_49.5%_0_0)]">
                  <SchemePreview scheme="light" />
                </div>
                <div className="absolute inset-0 [clip-path:inset(0_0_0_50%)]">
                  <SchemePreview scheme="dark" />
                </div>
              </div>
            ) : (
              <SchemePreview scheme={o.value} />
            )}
          </div>
          <div className={cn(compact ? 'pt-1.5 text-[0.8125rem]' : 'flex-1 text-sm sm:pt-1.5 sm:text-[0.8125rem]', scheme === o.value ? 'font-medium text-foreground' : 'text-muted-foreground')}>{o.label}</div>
          {!compact && scheme === o.value ? <RiCheckFill className="mr-2 size-4 text-accent sm:hidden" /> : null}
        </button>
      ))}
    </div>
  )
}

function Orb({ colors, active, mode }: { colors: readonly [string, string]; active: boolean; mode: 'light' | 'dark' }) {
  return (
    <span
      className={cn('relative inline-block rounded-full shadow-md zoom-layer transition-transform duration-200 ease-out', active && '[--zoom:1.1]')}
      style={{
        width: 'var(--orb)',
        height: 'var(--orb)',
        background: `radial-gradient(circle at 30% 25%, ${colors[0]} 0%, ${colors[1]} 70%, ${mode === 'dark' ? '#000' : colors[1]} 130%)`,
      }}
    >
      {active ? (
        <span className="absolute -bottom-0.5 -right-0.5 grid size-4 place-items-center rounded-full bg-raised text-foreground shadow">
          {mode === 'light' ? <RiSunFill className="size-2.5" /> : <RiMoonFill className="size-2.5" />}
        </span>
      ) : null}
    </span>
  )
}

export function ThemePicker({ compact }: { compact?: boolean }) {
  const { theme, setTheme, scheme } = useAppearance()
  const dark = scheme === 'dark' || (scheme === 'system' && document.documentElement.classList.contains('dark'))
  return (
    <div className={cn('grid', compact ? 'grid-cols-3 gap-2 [--orb:22px]' : 'grid-cols-2 gap-2 [--orb:44px] sm:gap-4 sm:[--orb:56px] md:grid-cols-3 lg:grid-cols-4')}>
      {THEME_PRESETS.map((p) => {
        const active = p.id === theme
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => setTheme(p.id)}
            className={cn(
              'flex cursor-pointer flex-col rounded-xl transition-colors',
              compact ? 'items-center gap-1.5 p-2' : 'gap-3 p-3 sm:gap-4 sm:p-4',
              active ? 'bg-accent-soft' : 'bg-surface hover:bg-field',
            )}
          >
            <div className={cn('flex justify-center', compact ? 'gap-1' : 'gap-4 py-2')}>
              <Orb colors={p.light} active={active && !dark} mode="light" />
              <Orb colors={p.dark} active={active && dark} mode="dark" />
            </div>
            <span className={cn('text-left', compact ? 'text-xs' : 'text-sm font-medium')}>{p.name}</span>
          </button>
        )
      })}
    </div>
  )
}

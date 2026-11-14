import { Popover, PopoverContent, PopoverTrigger } from '@yoru/ui'
import { Palette } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { SchemePicker, ThemePicker } from './theme-picker'

export function QuickAppearance() {
  const { t } = useTranslation()
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t('settings.appearance')}
          className="fixed bottom-5 right-5 z-40 grid size-12 cursor-pointer place-items-center rounded-full bg-raised text-foreground shadow-xl transition-[scale] duration-200 ease-out will-change-[scale] hover:scale-105"
        >
          <Palette className="size-5" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" className="w-80 space-y-3 p-3">
        <div className="text-xs font-medium text-subtle-foreground">{t('settings.colorScheme')}</div>
        <SchemePicker compact />
        <div className="text-xs font-medium text-subtle-foreground">{t('settings.themes')}</div>
        <ThemePicker compact />
      </PopoverContent>
    </Popover>
  )
}

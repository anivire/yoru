import { cn } from '@yoru/ui'
import { RiArrowRightSLine } from '@remixicon/react'
import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { TLink } from './transition-link'

export interface Crumb {
  label: string
  to?: string
}

export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  const { t } = useTranslation()
  return (
    <nav aria-label={t('common.breadcrumbs')} className={cn('flex min-w-0 items-center gap-1 text-[0.8125rem] text-muted-foreground', className)}>
      {items.map((item, i) => {
        const last = i === items.length - 1
        return (
          <Fragment key={`${i}:${item.label}`}>
            {i ? <RiArrowRightSLine className="size-3.5 shrink-0 text-subtle-foreground" /> : null}
            {item.to && !last ? (
              <TLink to={item.to} className="max-w-48 shrink-0 truncate transition-colors hover:text-foreground">
                {item.label}
              </TLink>
            ) : (
              <span aria-current={last ? 'page' : undefined} className={cn('truncate', last ? 'min-w-0 text-foreground' : 'shrink-0')}>
                {item.label}
              </span>
            )}
          </Fragment>
        )
      })}
    </nav>
  )
}

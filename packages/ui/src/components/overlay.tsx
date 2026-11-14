import { RiArrowDownSFill, RiCheckFill, RiCloseFill } from '@remixicon/react'
import { Dialog as D, DropdownMenu as M, HoverCard as H, Popover as P, Select as S, Switch as Sw, Tooltip as T } from 'radix-ui'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '../lib/cn'

const surface =
  'z-50 rounded-lg bg-raised text-foreground [--field:var(--raised-field)] [--field-hover:var(--raised-field-hover)] [--muted:var(--raised-muted)] shadow-[0_2px_6px_-2px_rgb(0_0_0/0.12),0_18px_48px_-12px_rgb(0_0_0/0.3)]'
export const panel = `${surface} animate-pop`

export const Popover = P.Root
export const PopoverTrigger = P.Trigger
export const PopoverClose = P.Close

export function PopoverContent({ className, align = 'end', sideOffset = 8, ...props }: ComponentProps<typeof P.Content>) {
  return (
    <P.Portal>
      <P.Content align={align} sideOffset={sideOffset} className={cn(panel, 'w-80 overflow-hidden', className)} {...props} />
    </P.Portal>
  )
}

export const HoverCard = H.Root
export const HoverCardTrigger = H.Trigger

export function HoverCardContent({ className, align = 'start', sideOffset = 8, ...props }: ComponentProps<typeof H.Content>) {
  return (
    <H.Portal>
      <H.Content align={align} sideOffset={sideOffset} collisionPadding={12} className={cn(panel, 'w-80 overflow-hidden', className)} {...props} />
    </H.Portal>
  )
}

export const Dialog = D.Root
export const DialogTrigger = D.Trigger
export const DialogClose = D.Close

export function DialogContent({
  className,
  title,
  description,
  children,
  ...props
}: ComponentProps<typeof D.Content> & { title: ReactNode; description?: ReactNode }) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[0.125rem] animate-fade" />
      <D.Content
        className={cn(surface, 'fixed left-1/2 top-1/2 flex max-h-[85vh] animate-zoom w-[min(92vw,32rem)] -translate-x-1/2 -translate-y-1/2 flex-col', className)}
        {...props}
      >
        <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-5">
          <div>
            <D.Title className="text-[0.9375rem] font-semibold tracking-tight">{title}</D.Title>
            {description ? <D.Description className="mt-0.5 text-sm text-muted-foreground">{description}</D.Description> : null}
          </div>
          <D.Close className="-mr-1 cursor-pointer rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
            <RiCloseFill className="size-4" />
          </D.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </D.Content>
    </D.Portal>
  )
}

export function Lightbox({ src, title, closeLabel, children }: { src: string; title: string; closeLabel: string; children: ReactNode }) {
  return (
    <D.Root>
      <D.Trigger asChild>{children}</D.Trigger>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm animate-fade" />
        <D.Content aria-describedby={undefined} className="fixed inset-0 z-50 outline-none">
          <D.Title className="sr-only">{title}</D.Title>
          <D.Close aria-label={closeLabel} className="flex size-full cursor-zoom-out items-center justify-center p-4 sm:p-8">
            <img src={src} alt={title} className="max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] animate-zoom rounded-xl object-contain shadow-2xl sm:max-h-[calc(100dvh-4rem)] sm:max-w-[calc(100vw-4rem)]" />
          </D.Close>
          <D.Close aria-label={closeLabel} className="absolute right-4 top-4 grid size-9 cursor-pointer place-items-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70">
            <RiCloseFill className="size-5" />
          </D.Close>
        </D.Content>
      </D.Portal>
    </D.Root>
  )
}

export const DropdownMenu = M.Root
export const DropdownMenuTrigger = M.Trigger

export function DropdownMenuContent({ className, align = 'end', sideOffset = 6, ...props }: ComponentProps<typeof M.Content>) {
  return (
    <M.Portal>
      <M.Content align={align} sideOffset={sideOffset} className={cn(panel, 'min-w-44 p-1.5', className)} {...props} />
    </M.Portal>
  )
}

export function DropdownMenuItem({ className, ...props }: ComponentProps<typeof M.Item>) {
  return (
    <M.Item
      className={cn(
        'flex cursor-pointer select-none items-center gap-2.5 rounded-md px-3 py-2 text-sm outline-none data-[disabled]:pointer-events-none data-[highlighted]:bg-muted data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:text-muted-foreground',
        className,
      )}
      {...props}
    />
  )
}

export function DropdownMenuLabel({ className, ...props }: ComponentProps<typeof M.Label>) {
  return <M.Label className={cn('px-3 py-2 text-xs font-medium text-subtle-foreground', className)} {...props} />
}

export function DropdownMenuSeparator({ className, ...props }: ComponentProps<typeof M.Separator>) {
  return <M.Separator className={cn('my-1 h-1', className)} {...props} />
}

export interface SelectOption {
  value: string
  label: ReactNode
  hint?: ReactNode
}

export function Select({
  value,
  onValueChange,
  options,
  placeholder,
  className,
  icon,
  disabled,
  size = 'md',
}: {
  value: string | undefined
  onValueChange: (value: string) => void
  options: SelectOption[]
  placeholder?: ReactNode
  className?: string
  icon?: ReactNode
  disabled?: boolean
  size?: 'sm' | 'md'
}) {
  return (
    <S.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <S.Trigger
        className={cn(
          'inline-flex cursor-pointer items-center gap-2 rounded-lg bg-field text-left text-foreground transition-colors hover:bg-field-hover data-[placeholder]:text-subtle-foreground disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
          size === 'sm' ? 'h-8 px-2.5 text-[0.8125rem]' : 'h-9 px-3 text-sm',
          className,
        )}
      >
        {icon ? <span className="text-muted-foreground">{icon}</span> : null}
        <span className="min-w-0 flex-1 truncate">
          <S.Value placeholder={placeholder} />
        </span>
        <S.Icon>
          <RiArrowDownSFill className="-mr-1 size-5! text-muted-foreground" />
        </S.Icon>
      </S.Trigger>
      <S.Portal>
        <S.Content position="popper" sideOffset={6} className={cn(panel, 'max-h-80 min-w-[var(--radix-select-trigger-width)] overflow-hidden')}>
          <S.Viewport className="p-1.5">
            {options.map((o) => (
              <S.Item
                key={o.value}
                value={o.value}
                className="relative flex cursor-pointer select-none items-center gap-2 rounded-md py-2 pl-3 pr-8 text-sm outline-none data-[highlighted]:bg-muted"
              >
                <div className="min-w-0">
                  <S.ItemText>{o.label}</S.ItemText>
                  {o.hint ? <div className="truncate text-xs text-subtle-foreground">{o.hint}</div> : null}
                </div>
                <S.ItemIndicator className="absolute right-2.5">
                  <RiCheckFill className="size-4 text-accent" />
                </S.ItemIndicator>
              </S.Item>
            ))}
          </S.Viewport>
        </S.Content>
      </S.Portal>
    </S.Root>
  )
}

export function Tooltip({ content, children, side = 'top' }: { content: ReactNode; children: ReactNode; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  return (
    <T.Provider delayDuration={250}>
      <T.Root>
        <T.Trigger asChild>{children}</T.Trigger>
        <T.Portal>
          <T.Content side={side} sideOffset={6} className={cn(panel, 'max-w-72 rounded-md px-2.5 py-1.5 text-xs')}>
            {content}
          </T.Content>
        </T.Portal>
      </T.Root>
    </T.Provider>
  )
}

export function Switch({ className, ...props }: ComponentProps<typeof Sw.Root>) {
  return (
    <Sw.Root
      className={cn(
        'inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full bg-field-hover p-0.5 transition-colors data-[state=checked]:bg-accent disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <Sw.Thumb className="size-3.5 rounded-full bg-foreground shadow transition-transform data-[state=checked]:translate-x-4 data-[state=checked]:bg-accent-foreground" />
    </Sw.Root>
  )
}

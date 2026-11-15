import { Logo, cn } from '@yoru/ui'
import type { ReactNode } from 'react'
import { AppearancePopover } from './appearance-panel'
import { useHeader } from './app-shell'
import { Footer } from './footer'

export function PublicShell({ children }: { children: ReactNode }) {
  const header = useHeader()
  return (
    <div className="flex min-h-dvh flex-col">
      <header ref={header.ref} className="sticky top-0 z-40 pt-2">
        <div className="page-frame px-4 sm:px-6">
          <div
            className={cn(
              'flex h-12 items-center -mx-2 rounded-full px-2 transition-[background-color,backdrop-filter] duration-300 sm:h-14 sm:-mx-4 sm:px-4',
              header.scrolled ? 'bg-background/55 backdrop-blur-2xl backdrop-saturate-150' : 'bg-transparent',
            )}
          >
            <Logo className="[&>span]:text-[0.9375rem] [&_svg]:size-6 sm:[&>span]:text-[17px] sm:[&_svg]:size-7" />
            <AppearancePopover className="ml-auto" />
          </div>
        </div>
      </header>
      <main className="page-frame w-full flex-1 px-4 pb-8 pt-4 sm:px-6 sm:pt-8">{children}</main>
      <Footer scope="public" />
    </div>
  )
}

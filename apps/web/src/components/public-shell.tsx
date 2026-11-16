import { Logo } from '@yoru/ui'
import type { ReactNode } from 'react'
import { AppearancePopover, TitleLanguageMenu } from './appearance-panel'
import { Footer } from './footer'

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="pt-2">
        <div className="page-frame px-4 sm:px-6">
          <div className="flex h-12 items-center gap-2 sm:h-14">
            <Logo className="[&>span]:text-[0.9375rem] [&_svg]:size-6 sm:[&>span]:text-[17px] sm:[&_svg]:size-7" />
            <TitleLanguageMenu className="ml-auto" />
            <AppearancePopover />
          </div>
        </div>
      </header>
      <main className="page-frame w-full flex-1 px-4 pb-8 pt-4 sm:px-6 sm:pt-8">{children}</main>
      <Footer scope="public" />
    </div>
  )
}

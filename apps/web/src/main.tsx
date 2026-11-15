import './styles.css'
import './lib/i18n'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from '@yoru/ui'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import { UpdateWatcher } from './components/update-watcher'
import { AppearanceProvider } from './lib/appearance'
import { queryClient } from './lib/queries'
import { router } from './router'
import { installSounds } from './lib/sounds'

installSounds()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AppearanceProvider>
        <RouterProvider router={router} />
        <Toaster />
        <UpdateWatcher />
      </AppearanceProvider>
    </QueryClientProvider>
  </StrictMode>,
)

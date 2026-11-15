import { toast as sonner } from 'sonner'

export type ToastKind = 'success' | 'error' | 'warning' | 'info'

const listeners = new Set<(kind: ToastKind) => void>()

export function onToast(listener: (kind: ToastKind) => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function emit(kind: ToastKind) {
  for (const listener of listeners) listener(kind)
}

export const toast = Object.assign((...args: Parameters<typeof sonner>) => sonner(...args), sonner, {
  success: (...args: Parameters<typeof sonner.success>) => {
    emit('success')
    return sonner.success(...args)
  },
  error: (...args: Parameters<typeof sonner.error>) => {
    emit('error')
    return sonner.error(...args)
  },
  warning: (...args: Parameters<typeof sonner.warning>) => {
    emit('warning')
    return sonner.warning(...args)
  },
  info: (...args: Parameters<typeof sonner.info>) => {
    emit('info')
    return sonner.info(...args)
  },
})

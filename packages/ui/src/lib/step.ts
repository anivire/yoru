const listeners = new Set<(position: number) => void>()
const endListeners = new Set<() => void>()

export function onStep(listener: (position: number) => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function emitStep(position: number) {
  for (const listener of listeners) listener(position)
}

export function onStepEnd(listener: () => void) {
  endListeners.add(listener)
  return () => {
    endListeners.delete(listener)
  }
}

export function emitStepEnd() {
  for (const listener of endListeners) listener()
}

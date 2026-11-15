const listeners = new Set<(position: number) => void>()

export function onStep(listener: (position: number) => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function emitStep(position: number) {
  for (const listener of listeners) listener(position)
}

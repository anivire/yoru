export function scrollToTarget(el: HTMLElement | null) {
  if (el) window.setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150)
}

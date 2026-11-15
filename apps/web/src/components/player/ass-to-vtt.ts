function vttTime(value: string): string | null {
  const m = value.trim().match(/^(\d+):(\d{1,2}):(\d{1,2})[.,](\d{1,3})$/)
  if (!m) return null
  const [, h, min, s, frac] = m
  const ms = frac!.padEnd(3, '0').slice(0, 3)
  return `${h!.padStart(2, '0')}:${min!.padStart(2, '0')}:${s!.padStart(2, '0')}.${ms}`
}

function cleanText(raw: string): string {
  return raw
    .replace(/\{[^}]*\}/g, '')
    .replace(/\\[Nn]/g, '\n')
    .replace(/\\h/g, ' ')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
}

export function assToVtt(ass: string): string {
  const cues: { start: string; end: string; text: string }[] = []
  let inEvents = false
  let fields: string[] = []
  for (const line of ass.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (trimmed.startsWith('[')) {
      inEvents = trimmed.toLowerCase() === '[events]'
      continue
    }
    if (!inEvents) continue
    if (trimmed.toLowerCase().startsWith('format:')) {
      fields = trimmed.slice(7).split(',').map((f) => f.trim().toLowerCase())
      continue
    }
    if (!trimmed.toLowerCase().startsWith('dialogue:') || !fields.length) continue
    const parts = trimmed.slice(9).split(',')
    const values = [...parts.slice(0, fields.length - 1), parts.slice(fields.length - 1).join(',')]
    const get = (name: string) => values[fields.indexOf(name)] ?? ''
    const raw = get('text')
    if (/\{[^}]*\\p[1-9]/.test(raw)) continue
    const start = vttTime(get('start'))
    const end = vttTime(get('end'))
    const text = cleanText(raw)
    if (start && end && text) cues.push({ start, end, text })
  }
  cues.sort((a, b) => a.start.localeCompare(b.start))
  return `WEBVTT\n\n${cues.map((c) => `${c.start} --> ${c.end}\n${c.text}`).join('\n\n')}\n`
}

interface Cue {
  start: number
  end: number
  text: string
  key: string
}

const MERGE_GAP_MS = 60

function parseTime(value: string): number | null {
  const m = value.trim().match(/^(\d+):(\d{1,2}):(\d{1,2})[.,](\d{1,3})$/)
  if (!m) return null
  const [, h, min, s, frac] = m
  return ((Number(h) * 60 + Number(min)) * 60 + Number(s)) * 1000 + Number(frac!.padEnd(3, '0').slice(0, 3))
}

function formatTime(ms: number): string {
  const pad = (n: number, width = 2) => String(n).padStart(width, '0')
  const h = Math.floor(ms / 3_600_000)
  const min = Math.floor((ms % 3_600_000) / 60_000)
  const s = Math.floor((ms % 60_000) / 1000)
  return `${pad(h)}:${pad(min)}:${pad(s)}.${pad(ms % 1000, 3)}`
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

function mergeDuplicates(cues: Cue[]): Cue[] {
  const merged: Cue[] = []
  const open = new Map<string, Cue>()
  for (const cue of cues) {
    const prev = open.get(cue.key)
    if (prev && cue.start <= prev.end + MERGE_GAP_MS) {
      prev.end = Math.max(prev.end, cue.end)
      if (cue.text.length > prev.text.length) prev.text = cue.text
      continue
    }
    const copy = { ...cue }
    merged.push(copy)
    open.set(cue.key, copy)
  }
  return merged
}

export function assToVtt(ass: string): string {
  const cues: Cue[] = []
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
    const start = parseTime(get('start'))
    const end = parseTime(get('end'))
    const text = cleanText(raw)
    if (start === null || end === null || end <= start || !text) continue
    cues.push({ start, end, text, key: text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '') })
  }
  cues.sort((a, b) => a.start - b.start || a.end - b.end)
  const result = mergeDuplicates(cues)
  return `WEBVTT\n\n${result.map((c) => `${formatTime(c.start)} --> ${formatTime(c.end)}\n${c.text}`).join('\n\n')}\n`
}

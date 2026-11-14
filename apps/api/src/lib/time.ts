const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

function zonedParts(ts: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'long',
  }).formatToParts(new Date(ts))
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0'
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour')),
    minute: Number(get('minute')),
    second: Number(get('second')),
    weekday: WEEKDAYS.indexOf(get('weekday').toLowerCase()),
  }
}

function offsetMs(ts: number, timeZone: string): number {
  const p = zonedParts(ts, timeZone)
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ts / 1000) * 1000
}

function zonedToUtc(year: number, month: number, day: number, hour: number, minute: number, timeZone: string): number {
  const guess = Date.UTC(year, month - 1, day, hour, minute)
  const first = guess - offsetMs(guess, timeZone)
  return guess - offsetMs(first, timeZone)
}

function safeZone(timeZone: string | null | undefined): string {
  if (!timeZone) return 'Asia/Tokyo'
  try {
    new Intl.DateTimeFormat('en-US', { timeZone })
    return timeZone
  } catch {
    return 'Asia/Tokyo'
  }
}

export function nextBroadcast(
  day: string | null | undefined,
  time: string | null | undefined,
  timeZone: string | null | undefined,
  notBefore?: string | null,
  from = Date.now(),
): Date | null {
  if (!day || !time) return null
  const weekday = WEEKDAYS.findIndex((w) => day.toLowerCase().startsWith(w))
  const match = /^(\d{1,2}):(\d{2})/.exec(time)
  if (weekday < 0 || !match) return null
  const zone = safeZone(timeZone)
  const hour = Number(match[1])
  const minute = Number(match[2])
  const start = Math.max(from, notBefore ? Date.parse(notBefore) - 86_400_000 : 0)
  for (let i = 0; i < 9; i++) {
    const p = zonedParts(start + i * 86_400_000, zone)
    if (p.weekday !== weekday) continue
    const ts = zonedToUtc(p.year, p.month, p.day, hour, minute, zone)
    if (ts > from) return new Date(ts)
  }
  return null
}

export function isoDate(value: { year?: number | null; month?: number | null; day?: number | null } | null | undefined): string | null {
  if (!value?.year) return null
  const m = String(value.month ?? 1).padStart(2, '0')
  const d = String(value.day ?? 1).padStart(2, '0')
  return `${value.year}-${m}-${d}`
}

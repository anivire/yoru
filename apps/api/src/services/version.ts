import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import type { ChangeType, Changelog, ChangelogEntry, VersionInfo } from '@yoru/shared'
import { db, now } from '../db/client'
import { settings, socialNotifications, users } from '../db/schema'
import { eq } from 'drizzle-orm'
import { env } from '../env'
import { cached, SourceOffError, upstreamJson } from '../lib/http'
import { featureEnabled } from '../lib/features'
import { githubConfig, sourceUrl } from '../lib/sources'

const LATEST_TTL = 30 * 60_000
const CHANGELOG_PAGE = 40
const CHANGE_TYPES = new Set<ChangeType>(['feat', 'fix', 'perf', 'style', 'refactor', 'docs', 'chore', 'build', 'revert'])

function readFile(name: string): string | null {
  for (let dir = process.cwd(), i = 0; i < 4; i++, dir = path.dirname(dir)) {
    const file = path.join(dir, name)
    if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8')
  }
  return null
}

function detectVersion(): string {
  if (env.appVersion) return env.appVersion
  const file = readFile('VERSION')?.trim()
  if (file) return file
  for (let dir = process.cwd(), i = 0; i < 4; i++, dir = path.dirname(dir)) {
    const file = path.join(dir, 'package.json')
    if (!fs.existsSync(file)) continue
    const pkg = JSON.parse(fs.readFileSync(file, 'utf8')) as { name?: string; version?: string }
    if (pkg.name === 'yoru' && pkg.version) return pkg.version
  }
  return '0.0.0'
}

function detectCommit(): string | null {
  if (env.gitCommit) return env.gitCommit
  const file = readFile('COMMIT')?.trim()
  if (file && /^[0-9a-f]{7,40}$/.test(file)) return file
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null
  } catch {
    return null
  }
}

const current = { version: detectVersion(), commit: detectCommit() }

async function github<T>(route: string): Promise<T> {
  const { repo, token } = githubConfig()
  return upstreamJson<T>('github', 'GitHub', `${sourceUrl('github')}/repos/${repo}${route}`, {
    headers: { Accept: 'application/vnd.github+json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    timeoutMs: 10_000,
  })
}

interface GithubCommit {
  sha: string
  html_url: string
  commit: { message: string; committer?: { date?: string } }
}

interface GithubRelease {
  tag_name: string
  name: string | null
  html_url: string
  published_at: string | null
}

function newer(a: string, b: string) {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    const x = pa[i] ?? 0
    const y = pb[i] ?? 0
    if (x !== y) return x > y
  }
  return false
}

async function versionAt(sha: string): Promise<string | null> {
  const file = await github<{ content?: string }>(`/contents/package.json?ref=${sha}`).catch(() => null)
  if (!file?.content) return null
  try {
    const pkg = JSON.parse(Buffer.from(file.content, 'base64').toString('utf8')) as { version?: string }
    return pkg.version ?? null
  } catch {
    return null
  }
}

async function latestInfo(commit: string | null) {
  const { repo, branch } = githubConfig()
  if (!featureEnabled('updates')) throw new SourceOffError('github', 503, 'GitHub is disabled')
  return cached(`github:latest:${repo}:${branch}:${commit ?? ''}`, LATEST_TTL, async () => {
    const head = await github<GithubCommit>(`/commits/${branch}`)
    let behindBy: number | null = null
    if (commit && commit !== head.sha) {
      const compare = await github<{ ahead_by: number }>(`/compare/${commit}...${head.sha}`).catch(() => null)
      behindBy = compare ? compare.ahead_by : null
    }
    const version = commit === head.sha ? current.version : await versionAt(head.sha)
    return {
      latest: {
        commit: head.sha,
        version,
        message: head.commit.message.split('\n')[0] ?? '',
        date: head.commit.committer?.date ?? null,
        url: head.html_url,
      },
      behindBy: commit === head.sha ? 0 : behindBy,
    }
  })
}

async function latestRelease() {
  const { repo } = githubConfig()
  if (!featureEnabled('updates')) throw new SourceOffError('github', 503, 'GitHub is disabled')
  return cached(`github:release:${repo}`, LATEST_TTL, async () => {
    const release = await github<GithubRelease>('/releases/latest')
    return {
      commit: null,
      version: release.tag_name.replace(/^v/, ''),
      message: release.name || release.tag_name,
      date: release.published_at,
      url: release.html_url,
    }
  })
}

function toEntry(commit: GithubCommit): ChangelogEntry {
  const subject = commit.commit.message.split('\n')[0]?.trim() ?? ''
  const match = /^(\w+)(?:\(([^)]+)\))?!?:\s*(.+)$/.exec(subject)
  const type = match?.[1]?.toLowerCase() as ChangeType | undefined
  const release = type === 'chore' ? (/^release v?(\d+\.\d+\.\d+)$/.exec(match?.[3] ?? '')?.[1] ?? null) : null
  return {
    sha: commit.sha,
    type: type && CHANGE_TYPES.has(type) ? type : 'other',
    scope: match?.[2] ?? null,
    subject: match?.[3] ?? subject,
    release,
    date: commit.commit.committer?.date ?? null,
    url: commit.html_url,
  }
}

export async function changelog(page: number): Promise<Changelog> {
  const { repo, branch } = githubConfig()
  if (!featureEnabled('updates')) throw new SourceOffError('github', 503, 'GitHub is disabled')
  const commits = await cached(`github:changelog:${repo}:${branch}:${page}`, LATEST_TTL, () =>
    github<GithubCommit[]>(`/commits?sha=${encodeURIComponent(branch)}&per_page=${CHANGELOG_PAGE}&page=${page}`),
  )
  return { entries: commits.map(toEntry), current: current.commit, channel: env.releaseChannel, nextPage: commits.length === CHANGELOG_PAGE ? page + 1 : null }
}

export function buildInfo() {
  return { version: current.version, commit: current.commit }
}

export async function versionInfo(withUpdates: boolean): Promise<VersionInfo> {
  const repoUrl = `https://github.com/${githubConfig().repo}`
  const base = {
    version: current.version,
    commit: current.commit,
    commitUrl: current.commit ? `${repoUrl}/commit/${current.commit}` : null,
    channel: env.releaseChannel,
    repoUrl,
  }
  if (env.releaseChannel === 'stable') {
    const latest = withUpdates ? await latestRelease().catch(() => null) : null
    return {
      ...base,
      latest,
      behindBy: null,
      updateAvailable: Boolean(latest && newer(latest.version, current.version)),
      compareUrl: latest?.url ?? null,
    }
  }
  const info = withUpdates ? await latestInfo(current.commit).catch(() => null) : null
  const latest = info?.latest ?? null
  return {
    ...base,
    latest,
    behindBy: info?.behindBy ?? null,
    updateAvailable: Boolean(latest && current.commit && latest.commit !== current.commit && (info?.behindBy ?? 1) > 0),
    compareUrl: latest && current.commit ? `${repoUrl}/compare/${current.commit}...${latest.commit}` : null,
  }
}

const ANNOUNCED_KEY = 'announced_version'

export function announceVersion() {
  const { version } = current
  if (!version) return
  db.transaction(
    (tx) => {
      if (tx.select({ value: settings.value }).from(settings).where(eq(settings.key, ANNOUNCED_KEY)).get()?.value === version) return
      const at = now()
      const rows = tx.select({ id: users.id }).from(users).all().map((u) => ({ userId: u.id, actorId: u.id, type: 'release' as const, text: version, createdAt: at }))
      if (rows.length) tx.insert(socialNotifications).values(rows).run()
      tx.insert(settings).values({ key: ANNOUNCED_KEY, value: version }).onConflictDoUpdate({ target: settings.key, set: { value: version } }).run()
    },
    { behavior: 'immediate' },
  )
}

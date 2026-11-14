import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import type { VersionInfo } from '@yoru/shared'
import { env } from '../env'
import { cached } from '../lib/http'
import { githubConfig, sourceEnabled, sourceUrl } from '../lib/sources'

const LATEST_TTL = 30 * 60_000

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
  const res = await fetch(`${sourceUrl('github')}/repos/${repo}${route}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': env.userAgent,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`GitHub HTTP ${res.status}`)
  return (await res.json()) as T
}

interface GithubCommit {
  sha: string
  html_url: string
  commit: { message: string; committer?: { date?: string } }
}

async function latestInfo(commit: string | null) {
  const { repo, branch } = githubConfig()
  if (!sourceEnabled('github')) throw new Error('GitHub is disabled')
  return cached(`github:latest:${repo}:${branch}:${commit ?? ''}`, LATEST_TTL, async () => {
    const head = await github<GithubCommit>(`/commits/${branch}`)
    let behindBy: number | null = null
    if (commit && commit !== head.sha) {
      const compare = await github<{ ahead_by: number }>(`/compare/${commit}...${head.sha}`).catch(() => null)
      behindBy = compare ? compare.ahead_by : null
    }
    return {
      latest: {
        commit: head.sha,
        message: head.commit.message.split('\n')[0] ?? '',
        date: head.commit.committer?.date ?? null,
        url: head.html_url,
      },
      behindBy: commit === head.sha ? 0 : behindBy,
    }
  })
}

export async function versionInfo(withUpdates: boolean): Promise<VersionInfo> {
  const repoUrl = `https://github.com/${githubConfig().repo}`
  const info = withUpdates ? await latestInfo(current.commit).catch(() => null) : null
  const latest = info?.latest ?? null
  return {
    version: current.version,
    commit: current.commit,
    commitUrl: current.commit ? `${repoUrl}/commit/${current.commit}` : null,
    repoUrl,
    latest,
    behindBy: info?.behindBy ?? null,
    updateAvailable: Boolean(latest && current.commit && latest.commit !== current.commit && (info?.behindBy ?? 1) > 0),
    compareUrl: latest && current.commit ? `${repoUrl}/compare/${current.commit}...${latest.commit}` : null,
  }
}

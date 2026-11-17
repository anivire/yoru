import { execFileSync } from 'node:child_process'

const tag = process.argv[2]
if (!tag) throw new Error('usage: release-notes.mjs <tag>')
const repo = process.env.GITHUB_REPOSITORY || 'anivire/yoru'
const url = `https://github.com/${repo}`

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

function previousTag() {
  try {
    return git('describe', '--tags', '--abbrev=0', '--match', 'v*.*.*', `${tag}^`)
  } catch {
    return null
  }
}

const SECTIONS = [
  ['New', ['feat']],
  ['Improved', ['perf', 'style']],
  ['Fixed', ['fix']],
]

const out = []
if (git('cat-file', '-t', tag) === 'tag') {
  const intro = git('tag', '-l', '--format=%(contents)', tag).replace(/-----BEGIN PGP SIGNATURE-----[\s\S]*$/, '').trim()
  if (intro) out.push(intro, '')
}

const previous = previousTag()
if (previous) {
  const log = git('log', '--no-merges', '--format=%H%x09%s', `${previous}..${tag}`)
  const commits = log
    ? log.split('\n').map((line) => {
        const [sha, subject] = line.split('\t')
        const match = /^(\w+)(?:\([^)]+\))?!?:\s*(.+)$/.exec(subject)
        return { sha, type: match?.[1].toLowerCase() ?? 'other', text: match?.[2] ?? subject }
      })
    : []
  for (const [title, types] of SECTIONS) {
    const items = commits.filter((c) => types.includes(c.type))
    if (!items.length) continue
    out.push(`### ${title}`, '')
    for (const c of items) out.push(`- ${c.text.charAt(0).toUpperCase()}${c.text.slice(1)} ([${c.sha.slice(0, 7)}](${url}/commit/${c.sha}))`)
    out.push('')
  }
  out.push(`**Full changelog**: ${url}/compare/${previous}...${tag}`)
} else {
  out.push(`The first tagged release. Earlier changes are in the [commit history](${url}/commits/${tag}).`)
}

process.stdout.write(`${out.join('\n')}\n`)

import path from 'node:path'

function str(name: string, fallback = ''): string {
  const value = process.env[name]
  return value === undefined || value === '' ? fallback : value
}

function int(name: string, fallback: number): number {
  const value = Number(process.env[name])
  return Number.isFinite(value) && value > 0 ? value : fallback
}

const dataDir = path.resolve(str('DATA_DIR', './data'))
const releaseChannel = str('RELEASE_CHANNEL') === 'stable' ? ('stable' as const) : ('edge' as const)

export const env = {
  production: process.env.NODE_ENV === 'production',
  port: int('PORT', 3000),
  host: str('HOST', '0.0.0.0'),
  appUrl: str('APP_URL', 'http://localhost:5173').replace(/\/+$/, ''),
  dataDir,
  databasePath: path.resolve(str('DATABASE_PATH', path.join(dataDir, 'yoru.db'))),
  webDist: str('WEB_DIST'),
  sessionDays: int('SESSION_DAYS', 30),
  adminUsername: str('ADMIN_USERNAME'),
  adminPassword: str('ADMIN_PASSWORD'),
  anime365Url: str('ANIME365_URL', 'https://smotret-anime.app').replace(/\/+$/, ''),
  anime365Token: str('ANIME365_TOKEN'),
  jikanUrl: str('JIKAN_URL', 'https://api.jikan.moe/v4').replace(/\/+$/, ''),
  metadataSource: str('METADATA_SOURCE', 'jikan'),
  shikimoriUrl: str('SHIKIMORI_URL', 'https://shikimori.io').replace(/\/+$/, ''),
  anilistUrl: str('ANILIST_URL', 'https://graphql.anilist.co').replace(/\/+$/, ''),
  aniskipUrl: str('ANISKIP_URL', 'https://api.aniskip.com').replace(/\/+$/, ''),
  anilibriaUrl: str('ANILIBRIA_URL', 'https://api.anilibria.app/api/v1').replace(/\/+$/, ''),
  kitsuUrl: str('KITSU_URL', 'https://kitsu.app/api/edge').replace(/\/+$/, ''),
  kodikUrl: str('KODIK_URL', 'https://kodikapi.com').replace(/\/+$/, ''),
  kodikToken: str('KODIK_TOKEN'),
  releasePollMinutes: int('RELEASE_POLL_MINUTES', 5),
  oauth: {
    anilist: { clientId: str('ANILIST_CLIENT_ID'), clientSecret: str('ANILIST_CLIENT_SECRET') },
    shikimori: { clientId: str('SHIKIMORI_CLIENT_ID'), clientSecret: str('SHIKIMORI_CLIENT_SECRET') },
    mal: { clientId: str('MAL_CLIENT_ID'), clientSecret: str('MAL_CLIENT_SECRET') },
  },
  userAgent: str('USER_AGENT', 'Yoru'),
  appVersion: str('APP_VERSION'),
  gitCommit: str('GIT_COMMIT'),
  releaseChannel,
  githubRepo: str('GITHUB_REPO', 'anivire/yoru'),
  githubBranch: str('GITHUB_BRANCH', releaseChannel === 'stable' ? 'master' : 'develop'),
  githubToken: str('GITHUB_TOKEN'),
}

export const secureCookies = env.appUrl.startsWith('https://')

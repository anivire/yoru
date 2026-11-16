import variant from '@jitl/quickjs-singlefile-mjs-release-sync'
import { type QuickJSDeferredPromise, type QuickJSWASMModule, newQuickJSWASMModuleFromVariant, shouldInterruptAfterDeadline } from 'quickjs-emscripten-core'
import { env } from '../env'

const MEMORY_LIMIT = 32 * 1024 * 1024
const STACK_LIMIT = 1024 * 1024
const CALL_TIMEOUT_MS = 15_000
const FETCH_TIMEOUT_MS = 10_000
const MAX_BODY_BYTES = 5 * 1024 * 1024

const PRELUDE = `
globalThis.fetch = async (url, init) => {
  const r = JSON.parse(await __yoruFetch(String(url), JSON.stringify(init ?? {})))
  return {
    ok: r.status >= 200 && r.status < 300,
    status: r.status,
    url: r.url,
    headers: { get: (name) => r.headers[String(name).toLowerCase()] ?? null },
    text: async () => r.body,
    json: async () => JSON.parse(r.body),
  }
}
globalThis.URLSearchParams = class URLSearchParams {
  constructor(init) {
    this.entries_ = []
    if (typeof init === 'string') {
      const decode = (text) => decodeURIComponent(text.split('+').join(' '))
      for (const part of (init.startsWith('?') ? init.slice(1) : init).split('&')) {
        if (!part) continue
        const [key, value = ''] = part.split('=')
        this.entries_.push([decode(key), decode(value)])
      }
    } else if (init) {
      for (const [key, value] of Array.isArray(init) ? init : Object.entries(init)) this.entries_.push([String(key), String(value)])
    }
  }
  append(key, value) { this.entries_.push([String(key), String(value)]) }
  set(key, value) { this.delete(key); this.append(key, value) }
  get(key) { return this.entries_.find((e) => e[0] === key)?.[1] ?? null }
  getAll(key) { return this.entries_.filter((e) => e[0] === key).map((e) => e[1]) }
  has(key) { return this.entries_.some((e) => e[0] === key) }
  delete(key) { this.entries_ = this.entries_.filter((e) => e[0] !== key) }
  toString() { return this.entries_.map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&') }
}
const __yoruLine = (args) => args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')
globalThis.console = {
  log: (...args) => __yoruLog('log', __yoruLine(args)),
  info: (...args) => __yoruLog('log', __yoruLine(args)),
  warn: (...args) => __yoruLog('warn', __yoruLine(args)),
  error: (...args) => __yoruLog('error', __yoruLine(args)),
}
`

export class ExtensionError extends Error {}

let quickjs: Promise<QuickJSWASMModule> | null = null

function loadQuickJS(): Promise<QuickJSWASMModule> {
  quickjs ??= newQuickJSWASMModuleFromVariant(variant)
  return quickjs
}

async function readLimited(res: Response): Promise<string> {
  const reader = res.body?.getReader()
  if (!reader) return ''
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > MAX_BODY_BYTES) {
      await reader.cancel()
      throw new ExtensionError('Response is too large')
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks).toString('utf8')
}

async function hostFetch(url: string, init: { method?: string; headers?: Record<string, string>; body?: string }): Promise<string> {
  const target = new URL(url)
  if (target.protocol !== 'http:' && target.protocol !== 'https:') throw new ExtensionError('Only http and https are allowed')
  const res = await fetch(target, {
    method: init.method ?? 'GET',
    headers: { 'User-Agent': env.userAgent, ...init.headers },
    body: init.body,
    redirect: 'follow',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  const body = await readLimited(res)
  return JSON.stringify({ status: res.status, url: res.url, headers: Object.fromEntries(res.headers), body })
}

export interface SandboxOptions {
  settings: Record<string, string>
  log: (level: 'log' | 'warn' | 'error', line: string) => void
}

export async function callExtension(code: string, method: string, args: unknown[], options: SandboxOptions): Promise<unknown> {
  const QuickJS = await loadQuickJS()
  const runtime = QuickJS.newRuntime()
  runtime.setMemoryLimit(MEMORY_LIMIT)
  runtime.setMaxStackSize(STACK_LIMIT)
  const deadline = Date.now() + CALL_TIMEOUT_MS
  runtime.setInterruptHandler(shouldInterruptAfterDeadline(deadline))
  const ctx = runtime.newContext()
  const deferreds = new Set<QuickJSDeferredPromise>()
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const fetchFn = ctx.newFunction('__yoruFetch', (urlHandle, initHandle) => {
      const url = ctx.getString(urlHandle)
      const init = JSON.parse(ctx.getString(initHandle) || '{}') as Parameters<typeof hostFetch>[1]
      const deferred = ctx.newPromise()
      deferreds.add(deferred)
      hostFetch(url, init).then(
        (json) => {
          if (!deferred.alive) return
          const value = ctx.newString(json)
          deferred.resolve(value)
          value.dispose()
        },
        (error: unknown) => {
          if (!deferred.alive) return
          const value = ctx.newError(error instanceof Error ? error.message : String(error))
          deferred.reject(value)
          value.dispose()
        },
      )
      void deferred.settled.then(() => {
        deferreds.delete(deferred)
        deferred.dispose()
        if (runtime.alive) runtime.executePendingJobs()
      })
      return deferred.handle
    })
    ctx.setProp(ctx.global, '__yoruFetch', fetchFn)
    fetchFn.dispose()
    const logFn = ctx.newFunction('__yoruLog', (levelHandle, lineHandle) => {
      const level = ctx.getString(levelHandle)
      options.log(level === 'warn' || level === 'error' ? level : 'log', ctx.getString(lineHandle).slice(0, 2000))
    })
    ctx.setProp(ctx.global, '__yoruLog', logFn)
    logFn.dispose()

    ctx.unwrapResult(ctx.evalCode(`${PRELUDE}\nglobalThis.$settings = Object.freeze(${JSON.stringify(options.settings)})`, 'yoru-prelude.js')).dispose()
    ctx.unwrapResult(ctx.evalCode(code, 'extension.js')).dispose()
    const call = ctx.unwrapResult(
      ctx.evalCode(
        `(async () => {
          if (typeof Provider !== 'function') throw new Error('The extension does not define a Provider class')
          const provider = new Provider()
          if (typeof provider[${JSON.stringify(method)}] !== 'function') throw new Error('The extension does not implement ${method}')
          const result = await provider[${JSON.stringify(method)}](...${JSON.stringify(args)})
          return JSON.stringify(result ?? null)
        })()`,
        'yoru-call.js',
      ),
    )
    const settled = ctx.resolvePromise(call)
    call.dispose()
    runtime.executePendingJobs()
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new ExtensionError('The extension took too long to answer')), Math.max(0, deadline - Date.now()))
    })
    const result = await Promise.race([settled, timeout])
    if (result.error) {
      const error: unknown = ctx.dump(result.error)
      result.error.dispose()
      const message = typeof error === 'object' && error && 'message' in error ? String((error as { message: unknown }).message) : String(error)
      throw new ExtensionError(message)
    }
    const json = ctx.getString(result.value)
    result.value.dispose()
    return JSON.parse(json) as unknown
  } finally {
    clearTimeout(timer)
    for (const deferred of deferreds) if (deferred.alive) deferred.dispose()
    ctx.dispose()
    runtime.dispose()
  }
}

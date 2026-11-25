/**
 * server.mjs — Taskmarket live market visualizer
 *
 * @module server
 * @path ventures/taskmarket-visualizer/server.mjs
 * @description 2026-11-25 起为 Taskmarket $50 赏金构建。服务端拉取公开 API 并缓存 ≥60s，
 *   浏览器只读缓存（API 禁止跨站直连）。
 *
 * @rule server_side_fetch P0 — 所有 API 调用在服务器完成；浏览器不得直连 api.taskmarket.dev
 *   （任务规则：API 不允许来自其它网站的浏览器请求）
 * @rule cache_min_60s P1 — 数据缓存至少 60 秒；刷新至少每小时（任务规则）
 * @metric cacheAgeSec — 当前缓存年龄（秒），页面"数据截至"显示它
 * @exit 0=正常
 */
import http from 'node:http'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '.')
const PUBLIC = join(ROOT, 'public')
const PORT = process.env.PORT || 3000
const CACHE_TTL_MS = 60_000
const REFRESH_INTERVAL_MS = 60 * 60 * 1000 // 每小时
const API = 'https://api.taskmarket.dev'
const CHAINS = [4217, 8453]

let cache = { at: 0, data: null }

async function fetchJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(20000), headers: { 'user-agent': 'taskmarket-visualizer/1.0' } })
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return res.json()
}

async function collect() {
  const out = { chains: {}, tasks: {}, feed: {} }
  for (const chainId of CHAINS) {
    out.chains[chainId] = {
      stats: await fetchJson(`${API}/api/market/stats?chainId=${chainId}`),
      breakdowns: await fetchJson(`${API}/api/stats/breakdowns?chainId=${chainId}`),
      timeSeries: await fetchJson(`${API}/api/stats/platform-time-series?chainId=${chainId}&range=30d&bucket=day`),
      heatmap: await fetchJson(`${API}/api/stats/activity-heatmap?chainId=${chainId}&range=30d&dimension=hourOfWeek`),
    }
  }
  out.tasks = {}
  for (const chainId of CHAINS) {
    let cursor = '', tasks = [], pages = 0
    do {
      const q = `${API}/api/tasks?chainId=${chainId}&status=open&sort=newest&limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`
      const page = await fetchJson(q)
      tasks = tasks.concat(page.items ?? page.tasks ?? [])
      cursor = page.nextCursor ?? page.cursor ?? ''
      pages++
    } while (cursor && pages < 10)
    out.tasks[chainId] = tasks
  }
  out.feed = {}
  for (const chainId of CHAINS) {
    out.feed[chainId] = await fetchJson(`${API}/api/stats/activity-feed?chainId=${chainId}&limit=30`)
  }
  return out
}

async function getCached(force = false) {
  const now = Date.now()
  if (force || !cache.data || now - cache.at > REFRESH_INTERVAL_MS) {
    try {
      cache = { at: now, data: await collect() }
    } catch (e) {
      if (!cache.data) throw e // 冷启动失败 → 502
    }
  }
  return cache
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)
  if (url.pathname === '/api/data') {
    try {
      const c = await getCached()
      res.setHeader('content-type', 'application/json')
      res.setHeader('cache-control', 'public, max-age=60')
      res.end(JSON.stringify({ at: c.at, ageSec: Math.round((Date.now() - c.at) / 1000), data: c.data }))
    } catch (e) {
      res.statusCode = 502
      res.end(JSON.stringify({ error: 'upstream-fetch-failed', detail: String(e?.message ?? e) }))
    }
    return
  }
  try {
    const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1)
    const body = await readFile(join(PUBLIC, file))
    const ext = file.slice(file.lastIndexOf('.'))
    res.setHeader('content-type', { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' }[ext] ?? 'application/octet-stream')
    res.end(body)
  } catch {
    res.statusCode = 404
    res.end('not found')
  }
})

server.listen(PORT, () => console.log(`taskmarket-visualizer on http://localhost:${PORT}`))

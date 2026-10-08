import http from 'node:http'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {promises as fs} from 'node:fs'
import {randomUUID, createHash} from 'node:crypto'
import {createReadStream} from 'node:fs'

const here = path.dirname(fileURLToPath(import.meta.url))
const repo = path.resolve(here, '../..')
const defaultDist = path.join(repo, 'reality/cloud/xrhome/web-dist')
const mime = {'.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.wasm': 'application/wasm', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg'}
const fail = (status, message) => Object.assign(new Error(message), {status})
const json = (res, value, status = 200) => {
  res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8'})
  res.end(JSON.stringify(value))
}
const readBody = async (req) => {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > 32 * 1024 * 1024) throw fail(413, '檔案超過 32 MB 上限。')
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

// Do not resolve user-controlled absolute paths, parent segments, or symlinks.
export async function safePath(root, relative) {
  if (typeof relative !== 'string' || !relative || relative.includes('\\') ||
      relative.includes('\0') || relative.split('/').some(p => !p || p === '.' || p === '..')) {
    throw fail(400, '無效的檔案路徑。')
  }
  let current = root
  for (const segment of relative.split('/')) {
    current = path.join(current, segment)
    const stat = await fs.lstat(current).catch(e => { if (e.code !== 'ENOENT') throw e })
    if (stat?.isSymbolicLink()) throw fail(400, '不支援符號連結。')
  }
  return current
}
const atomicWrite = async (destination, content) => {
  await fs.mkdir(path.dirname(destination), {recursive: true})
  const temporary = `${destination}.${randomUUID()}.tmp`
  try {
    await fs.writeFile(temporary, content, {flag: 'wx'})
    await fs.rename(temporary, destination)
  } finally { await fs.rm(temporary, {force: true}) }
}
async function snapshot(root, relative = '') {
  const result = {}
  for (const entry of await fs.readdir(path.join(root, relative), {withFileTypes: true})) {
    if (entry.isSymbolicLink()) continue
    const name = relative ? `${relative}/${entry.name}` : entry.name
    if (entry.isDirectory()) Object.assign(result, await snapshot(root, name))
    else if (entry.isFile()) result[name] = (await fs.stat(path.join(root, name))).mtimeMs
  }
  return result
}
const isAsset = name => name.startsWith('assets/')

export async function createStudioServer({dataDir = path.join(here, '.data'), distDir = defaultDist} = {}) {
  await fs.mkdir(dataDir, {recursive: true})
  dataDir = await fs.realpath(dataDir)
  const streams = new Map()
  let mutation = Promise.resolve()
  const publish = (appKey, msg, sender) => {
    for (const res of streams.get(appKey) || []) if (res.studioClientId !== sender) res.write(`data: ${JSON.stringify({appKey, ...msg})}\n\n`)
  }
  const project = async (appKey) => {
    if (!/^[0-9a-f-]{36}$/.test(appKey || '')) throw fail(400, '無效的專案編號。')
    const dir = await safePath(dataDir, appKey)
    const metadata = JSON.parse(await fs.readFile(path.join(dir, 'project.json'), 'utf8'))
    return {dir, root: await safePath(dir, 'files'), metadata}
  }
  const sendFile = async (res, root, relative, userFile = false) => {
    const file = await safePath(root, relative)
    const stat = await fs.stat(file)
    if (!stat.isFile()) throw fail(404, '找不到檔案。')
    const contentType = mime[path.extname(file).toLowerCase()] || 'application/octet-stream'
    if (userFile) {
      // Source and SVG uploads must never execute with the editor's origin privileges.
      res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'")
      if (!/^(image|audio|video)\//.test(contentType)) {
        res.setHeader('Content-Disposition', 'attachment')
      }
    }
    res.writeHead(200, {'Content-Type': contentType, 'Content-Length': stat.size})
    const stream = createReadStream(file)
    stream.on('error', () => res.destroy())
    stream.pipe(res)
  }
  const route = async (req, res, url) => {
    const routePath = url.pathname
    const params = url.searchParams
    if (!routePath.startsWith('/api/')) {
      const file = routePath === '/' || !path.extname(routePath) ? 'index.html' : decodeURIComponent(routePath.slice(1))
      return sendFile(res, distDir, file)
    }
    if (routePath === '/api/preferences/current' && req.method === 'GET') {
      return json(res, {theme: 'dark', firstTimeSetupStatus: 'complete'})
    }
    if (routePath === '/api/project/list' && req.method === 'GET') {
      const projectByAppKey = {}
      for (const id of await fs.readdir(dataDir)) {
        if (!/^[0-9a-f-]{36}$/.test(id)) continue
        const {metadata} = await project(id)
        projectByAppKey[id] = {location: metadata.name, initialization: 'v2',
          validLocation: true, accessedAt: metadata.accessedAt}
      }
      return json(res, {projectByAppKey})
    }
    if (routePath === '/api/project/init-local' && req.method === 'POST') {
      const name = params.get('appName')?.trim()
      if (!name || name.length > 80 || /[\x00-\x1f]/.test(name)) throw fail(400, '請輸入 1–80 字的專案名稱。')
      if (params.get('templateZipUrl')) throw fail(400, '此預覽版只支援內建場景範本。')
      const appKey = randomUUID()
      const dir = path.join(dataDir, appKey)
      const scene = JSON.parse(await fs.readFile(path.join(repo, 'apps/desktop/new-project/src/.expanse.json')))
      const names = {'Ambient Light': '環境光', Box: '方塊', Camera: '攝影機', 'Directional Light': '平行光'}
      for (const obj of Object.values(scene.objects)) {
        obj.name = names[obj.name] || obj.name
        obj.components = {}
      }
      for (const space of Object.values(scene.spaces)) space.name = '預設場景'
      await atomicWrite(path.join(dir, 'files/.expanse.json'), JSON.stringify(scene, null, 2))
      await atomicWrite(path.join(dir, 'project.json'), JSON.stringify({name, accessedAt: Date.now()}))
      return json(res, {canceled: false, appKey, projectPath: name, initialization: 'v2'}, 201)
    }
    const direct = /^\/api\/file\/direct\/([^/]+)\/[^/]+\/(.+)$/.exec(routePath)
    const appKey = direct ? decodeURIComponent(direct[1]) : params.get('appKey')
    const {dir, root, metadata} = await project(appKey)
    const filename = direct ? decodeURIComponent(direct[2]) : params.get('path')
    if (routePath === '/api/project/events' && req.method === 'GET') {
      res.writeHead(200, {'Content-Type': 'text/event-stream', Connection: 'keep-alive'})
      res.write(': connected\n\n')
      if (!streams.has(appKey)) streams.set(appKey, new Set())
      res.studioClientId = params.get('clientId') || ''
      streams.get(appKey).add(res)
      const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 20000)
      req.on('close', () => {
        clearInterval(heartbeat)
        streams.get(appKey)?.delete(res)
        if (!streams.get(appKey)?.size) streams.delete(appKey)
      })
      return
    }
    if (routePath === '/api/project/recent' && req.method === 'POST') {
      await atomicWrite(path.join(dir, 'project.json'), JSON.stringify({...metadata, accessedAt: Date.now()}))
      return json(res, {})
    }
    if (routePath === '/api/project/delete' && req.method === 'DELETE') {
      await fs.rm(dir, {recursive: true})
      for (const stream of streams.get(appKey) || []) stream.end()
      return json(res, {})
    }
    if (routePath === '/api/project/runtime-metadata' && req.method === 'GET') {
      return sendFile(res, path.join(here, 'node_modules/@8thwall/ecs'), 'metadata.json')
    }
    if (routePath === '/api/project/config' && req.method === 'GET') {
      return json(res, {needsInjectFix: false, needsCopyPluginFix: false, missingDev8: true, needsDevSocketFix: false})
    }
    if (routePath === '/api/file/snapshot' && req.method === 'GET') return json(res, {timestampsByPath: await snapshot(root)})
    if (routePath === '/api/file/directory' && req.method === 'GET') {
      const entries = await fs.readdir(filename ? await safePath(root, filename) : root, {withFileTypes: true})
      return json(res, {contents: entries.filter(e => !e.isSymbolicLink()).map(e => e.name)})
    }
    if (routePath === '/api/file/hash/sha256' && req.method === 'GET') {
      const data = await fs.readFile(await safePath(root, filename))
      return json(res, {hash: createHash('sha256').update(data).digest('hex')})
    }
    if ((routePath === '/api/file' || direct) && req.method === 'GET') return sendFile(res, root, filename, true)
    if (routePath === '/api/file' && req.method === 'POST') {
      const file = await safePath(root, filename)
      const body = await readBody(req)
      if (filename === '.expanse.json') {
        let scene
        try { scene = JSON.parse(body.toString()) } catch { throw fail(400, '場景 JSON 格式錯誤。') }
        if (!scene || typeof scene.objects !== 'object' || !scene.objects || Array.isArray(scene.objects)) {
          throw fail(400, '場景缺少物件資料。')
        }
      }
      await atomicWrite(file, body)
      publish(appKey, isAsset(filename)
        ? {action: 'STUDIO_ASSET_CHANGE', path: filename, change: 'modified'}
        : {action: 'STUDIO_FILE_CHANGE', path: filename, content: body.toString('utf8')}, req.headers['x-studio-client'])
      return json(res, {})
    }
    if (routePath === '/api/file' && req.method === 'DELETE') {
      if (filename === '.expanse.json') throw fail(400, '不能刪除主場景檔案。')
      await fs.rm(await safePath(root, filename), {recursive: true, force: true})
      publish(appKey, {action: 'STUDIO_FILE_DELETE', path: filename})
      return json(res, {})
    }
    if (routePath === '/api/file/rename' && req.method === 'POST') {
      const oldPath = params.get('oldPath'), newPath = params.get('newPath')
      if ([oldPath, newPath].includes('.expanse.json')) throw fail(400, '不能重新命名主場景檔案。')
      const oldFile = await safePath(root, oldPath), newFile = await safePath(root, newPath)
      if (await fs.stat(newFile).then(() => true, e => { if (e.code === 'ENOENT') return false; throw e })) {
        throw fail(409, '目的地已存在。')
      }
      await fs.mkdir(path.dirname(newFile), {recursive: true})
      await fs.rename(oldFile, newFile)
      publish(appKey, {action: 'STUDIO_FILE_DELETE', path: oldPath})
      for (const name of Object.keys(await snapshot(root)).filter(p => p === newPath || p.startsWith(`${newPath}/`))) {
        publish(appKey, isAsset(name) ? {action: 'STUDIO_ASSET_CHANGE', path: name, change: 'created'}
          : {action: 'STUDIO_FILE_CHANGE', path: name, content: await fs.readFile(path.join(root, name), 'utf8')})
      }
      return json(res, {})
    }
    throw fail(501, '此瀏覽器預覽版尚未提供此功能。')
  }
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Referrer-Policy', 'same-origin')
    res.setHeader('X-Frame-Options', 'DENY')
    try {
      // This milestone is strictly loopback-only: no remote filesystem or process access.
      const allowedHosts = new Set([`127.0.0.1:${server.address().port}`, `localhost:${server.address().port}`])
      if (!allowedHosts.has(req.headers.host)) throw fail(403, '拒絕不明主機來源。')
      const origin = `http://${req.headers.host}`
      if ((req.headers.origin && req.headers.origin !== origin) || req.headers['sec-fetch-site'] === 'cross-site') {
        throw fail(403, '拒絕跨網站請求。')
      }
      if (!['GET', 'HEAD'].includes(req.method) && req.headers.origin !== origin) throw fail(403, '寫入請求缺少同源驗證。')
      const url = new URL(req.url, origin)
      // Serialize filesystem mutations, including rename/delete, without blocking file reads or SSE.
      if (['GET', 'HEAD'].includes(req.method)) await route(req, res, url)
      else {
        const work = mutation.then(() => route(req, res, url))
        mutation = work.catch(() => {})
        await work
      }
    } catch (error) {
      if (res.headersSent) { res.destroy(); return }
      const status = error.status || (error.code === 'ENOENT' ? 404 : 500)
      json(res, {message: status === 500 ? '伺服器無法完成要求。' : error.message}, status)
      if (status === 500) console.error(error)
    }
  })
  server.on('close', () => { for (const values of streams.values()) for (const res of values) res.end() })
  return server
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const server = await createStudioServer({dataDir: process.env.STUDIO_DATA_DIR})
  const port = Number(process.env.PORT || 8080)
  server.listen(port, '127.0.0.1', () => console.log(`8th Wall 瀏覽器工作室：http://127.0.0.1:${server.address().port}`))
}

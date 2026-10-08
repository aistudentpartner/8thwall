import {after, before, test} from 'node:test'
import assert from 'node:assert/strict'
import {promises as fs} from 'node:fs'
import os from 'node:os'
import http from 'node:http'
import path from 'node:path'
import {createStudioServer} from '../server.mjs'

let temp, server, origin, appKey
const start = async () => {
  server = await createStudioServer({dataDir: path.join(temp, 'projects'), distDir: path.join(temp, 'dist')})
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  origin = `http://127.0.0.1:${server.address().port}`
}
const stop = async () => {
  server.closeAllConnections()
  await new Promise(resolve => server.close(resolve))
}
const api = (route, options = {}) => fetch(`${origin}/api/${route}`, {
  ...options, headers: {Origin: origin, ...options.headers},
})
const file = name => `file?${new URLSearchParams({appKey, path: name})}`
before(async () => {
  temp = await fs.mkdtemp(path.join(os.tmpdir(), '8w-web-test-'))
  await fs.mkdir(path.join(temp, 'dist'))
  await fs.writeFile(path.join(temp, 'dist/index.html'), '<!doctype html><html lang="zh-TW">測試</html>')
  await start()
})
after(async () => { await stop(); await fs.rm(temp, {recursive: true, force: true}) })

test('creates a Traditional Chinese scene and lists its display name', async () => {
  const res = await api(`project/init-local?${new URLSearchParams({appName: '教學測試'})}`, {method: 'POST'})
  assert.equal(res.status, 201)
  appKey = (await res.json()).appKey
  const list = await (await api('project/list')).json()
  assert.equal(list.projectByAppKey[appKey].location, '教學測試')
  const scene = await (await api(file('.expanse.json'))).json()
  assert.ok(Object.values(scene.objects).some(obj => obj.name === '方塊'))
  assert.ok(Object.values(scene.objects).every(obj => Object.keys(obj.components).length === 0))
})
test('writes a scene atomically and persists it across a server restart', async () => {
  const scene = await (await api(file('.expanse.json'))).json()
  const box = Object.values(scene.objects).find(obj => obj.name === '方塊')
  box.name = '已儲存的教學方塊'
  box.position[0] = 2.5
  assert.equal((await api(file('.expanse.json'), {method: 'POST', body: JSON.stringify(scene)})).status, 200)
  await stop(); await start()
  assert.deepEqual(await (await api(file('.expanse.json'))).json(), scene)
  const snap = await (await api(`file/snapshot?appKey=${appKey}`)).json()
  assert.equal(Object.keys(snap.timestampsByPath).length, 1)
  assert.ok(snap.timestampsByPath['.expanse.json'] > 0)
})
test('invalid JSON cannot replace the last valid scene', async () => {
  const before = await (await api(file('.expanse.json'))).text()
  for (const body of ['{broken', '{}', '{"objects":null}', '{"objects":[]}']) {
    assert.equal((await api(file('.expanse.json'), {method: 'POST', body})).status, 400)
  }
  assert.equal(await (await api(file('.expanse.json'))).text(), before)
})
test('rejects path traversal, absolute paths and symlink targets', async () => {
  for (const name of ['../project.json', '/etc/passwd', 'assets/../../outside', 'assets\\bad', 'a//b', '\0']) {
    assert.equal((await api(file(name), {method: 'POST', body: 'bad'})).status, 400, name)
  }
  await fs.writeFile(path.join(temp, 'outside'), 'unchanged')
  await fs.symlink(path.join(temp, 'outside'), path.join(temp, 'projects', appKey, 'files', 'link'))
  assert.equal((await api(file('link'))).status, 400)
  assert.equal((await api(file('link'), {method: 'POST', body: 'bad'})).status, 400)
  assert.equal(await fs.readFile(path.join(temp, 'outside'), 'utf8'), 'unchanged')
  const snapshot = await (await api(`file/snapshot?appKey=${appKey}`)).json()
  assert.equal(snapshot.timestampsByPath.link, undefined)
})
test('rejects cross-origin mutations and DNS rebinding hosts', async () => {
  assert.equal((await api(file('test.txt'), {method: 'POST', body: 'bad', headers: {Origin: 'https://attacker.example'}})).status, 403)
  assert.equal((await fetch(`${origin}/api/${file('test.txt')}`, {method: 'POST', body: 'bad'})).status, 403)
  const status = await new Promise((resolve, reject) => {
    const req = http.get(`${origin}/api/project/list`, {headers: {Host: 'attacker.example'}}, res => {
      res.resume(); resolve(res.statusCode)
    })
    req.on('error', reject)
  })
  assert.equal(status, 403)
  assert.equal((await api('project/list', {headers: {'Sec-Fetch-Site': 'cross-site'}})).status, 403)
})
test('uploads binary assets, renames without overwriting, and deletes folders', async () => {
  const data = new Uint8Array([0, 128, 255, 50])
  assert.equal((await api(file('assets/demo.bin'), {method: 'POST', body: data})).status, 200)
  const get = await api(`file/direct/${appKey}/0/assets/demo.bin`)
  assert.deepEqual(new Uint8Array(await get.arrayBuffer()), data)
  const rename = new URLSearchParams({appKey, oldPath: 'assets/demo.bin', newPath: 'assets/新名稱.bin'})
  assert.equal((await api(`file/rename?${rename}`, {method: 'POST'})).status, 200)
  await api(file('assets/demo.bin'), {method: 'POST', body: 'keep'})
  assert.equal((await api(`file/rename?${rename}`, {method: 'POST'})).status, 409)
  assert.equal(await (await api(file('assets/demo.bin'))).text(), 'keep')
  assert.equal((await api(file('assets'), {method: 'DELETE'})).status, 200)
  assert.equal((await api(file('assets/demo.bin'))).status, 404)
})
test('serves uploaded active content with sandbox and nosniff protections', async () => {
  await api(file('assets/test.svg'), {method: 'POST', body: '<svg onload="alert(1)"></svg>'})
  const res = await api(file('assets/test.svg'))
  assert.equal(res.headers.get('content-security-policy'), "sandbox; default-src 'none'")
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff')
})
test('broadcasts committed changes to other clients', async () => {
  const controller = new AbortController()
  const response = await api(`project/events?appKey=${appKey}&clientId=reader`, {signal: controller.signal})
  assert.equal(response.headers.get('content-type'), 'text/event-stream')
  const reader = response.body.getReader()
  await reader.read() // connected comment
  await api(file('notes.txt'), {method: 'POST', body: '場景說明', headers: {'X-Studio-Client': 'writer'}})
  const event = new TextDecoder().decode((await reader.read()).value)
  assert.match(event, /STUDIO_FILE_CHANGE/)
  assert.match(event, /場景說明/)
  controller.abort()
})
test('protects the main scene and exposes no desktop process execution endpoints', async () => {
  assert.equal((await api(file('.expanse.json'), {method: 'DELETE'})).status, 400)
  for (const endpoint of ['project/install', 'project/build', 'project/open', 'file/open']) {
    assert.equal((await api(`${endpoint}?appKey=${appKey}`, {method: 'POST'})).status, 501)
  }
})
test('provides browser deep links and actual pinned ECS metadata', async () => {
  assert.match(await (await fetch(`${origin}/local-studio/${appKey}`)).text(), /lang="zh-TW"/)
  const meta = await (await api(`project/runtime-metadata?appKey=${appKey}`)).json()
  assert.equal(meta.version, '3.2.1')
  assert.ok(meta.componentSchema.length > 0)
})
test('deletes only the selected project', async () => {
  const second = await (await api('project/init-local?appName=保留', {method: 'POST'})).json()
  assert.equal((await api(`project/delete?appKey=${appKey}`, {method: 'DELETE'})).status, 200)
  const list = await (await api('project/list')).json()
  assert.equal(list.projectByAppKey[appKey], undefined)
  assert.equal(list.projectByAppKey[second.appKey].location, '保留')
})

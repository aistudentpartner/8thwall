// Runs inside the installed application with an isolated profile and temporary projects.
const {app, BrowserWindow, session, dialog} = require('electron')
const fs = require('node:fs/promises')
const fsSync = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const assert = require('node:assert/strict')
const {execFileSync} = require('node:child_process')
const JsZip = require('jszip')

const output = path.resolve('out/standalone-smoke')
let win

function triangleGlb() {
  const vertices = Buffer.from(new Float32Array([-1, 0, 0, 1, 0, 0, 0, 2, 0]).buffer)
  const gltf = {asset: {version: '2.0'}, scene: 0, scenes: [{nodes: [0]}],
    nodes: [{name: 'Imported triangle', mesh: 0}],
    meshes: [{primitives: [{attributes: {POSITION: 0}, material: 0}]}],
    materials: [{doubleSided: true, pbrMetallicRoughness: {baseColorFactor: [0.2, 0.8, 0.5, 1]}}],
    buffers: [{byteLength: vertices.length}],
    bufferViews: [{buffer: 0, byteOffset: 0, byteLength: vertices.length, target: 34962}],
    accessors: [{bufferView: 0, componentType: 5126, count: 3, type: 'VEC3',
      min: [-1, 0, 0], max: [1, 2, 0]}]}
  const jsonText = JSON.stringify(gltf)
  const json = Buffer.from(jsonText + ' '.repeat((4 - Buffer.byteLength(jsonText) % 4) % 4))
  const header = Buffer.alloc(12), jsonHeader = Buffer.alloc(8), binHeader = Buffer.alloc(8)
  header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4)
  header.writeUInt32LE(12 + 8 + json.length + 8 + vertices.length, 8)
  jsonHeader.writeUInt32LE(json.length, 0); jsonHeader.writeUInt32LE(0x4e4f534a, 4)
  binHeader.writeUInt32LE(vertices.length, 0); binHeader.writeUInt32LE(0x004e4942, 4)
  return Buffer.concat([header, jsonHeader, json, binHeader, vertices])
}

async function main() {
  // Register paths, graphics flags and protocols before yielding to Electron's ready event.
  fsSync.mkdirSync(output, {recursive: true})
  const temp = fsSync.mkdtempSync(path.join(os.tmpdir(), '8w 繁中離線驗收 '))
  app.setName('8thWall-Smoke')
  app.setPath('userData', temp)
  app.setPath('documents', temp)
  app.disableHardwareAcceleration()
  app.commandLine.appendSwitch('use-angle', 'swiftshader')
  app.commandLine.appendSwitch('enable-unsafe-swiftshader')
  process.env.DEPLOY_STAGE = 'dev'
  process.env.STANDALONE_MODE = '1'
  dialog.showErrorBox = (title, message) => {
    console.error(title, message)
    app.exit(1)
  }
  const blocked = []
  app.whenReady().then(() => session.defaultSession.webRequest.onBeforeRequest(
    {urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*']}, (details, callback) => {
      const local = ['localhost', '127.0.0.1', '[::1]'].includes(new URL(details.url).hostname)
      if (!local) blocked.push(details.url)
      callback({cancel: !local})
    }))
  require('../dist/start.js')
  await app.whenReady()
  win = BrowserWindow.getAllWindows()[0]
  assert.ok(win, 'desktop window created')
  win.webContents.on('console-message', details => {
    if (details.level === 'error') console.error('Renderer:', details.message)
  })
  const evaluate = code => win.webContents.executeJavaScript(code)
  async function waitFor(code, timeout = 120000) {
    const end = Date.now() + timeout
    while (Date.now() < end) {
      if (await evaluate(code).catch(() => false)) return
      await new Promise(resolve => setTimeout(resolve, 300))
    }
    throw new Error(`Timed out waiting for: ${code}\n${await evaluate('document.body.innerText')}`)
  }
  if (app.isPackaged) {
    const version = execFileSync(process.execPath,
      [path.join(process.resourcesPath, 'app.asar.unpacked/node_modules/npm/bin/npm-cli.js'), '--version'],
      {env: {...process.env, ELECTRON_RUN_AS_NODE: '1'}, encoding: 'utf8'})
    assert.match(version, /\d+\.\d+\.\d+/, 'bundled npm includes its transitive dependencies')
  }
  await waitFor("document.querySelector('#app-search') && document.documentElement.lang === 'zh-TW'")
  await evaluate(`fetch('preferences:///current', {method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({firstTimeStatus:'complete'})})`)
  const project = await evaluate(`(async () => {
    const response = await fetch('file-sync:///project/init-local?appName=' + encodeURIComponent('繁體中文離線驗收') + '&location=default', {method:'POST'});
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  })()`)
  assert.ok(project.appKey)
  win.webContents.send('navigate-to-path', `/local-studio/${project.appKey}`)
  await waitFor("document.body.innerText.includes('方塊') && document.querySelector('#studio-scene-viewport canvas') && document.querySelector('#studio-import-model:not(:disabled)')")
  const model = triangleGlb()
  const modelFile = path.join(temp, 'offline-model.glb')
  await fs.writeFile(modelFile, model)
  // Use the visible import button and the real file chooser's DOM input.
  win.webContents.debugger.attach('1.3')
  await win.webContents.debugger.sendCommand('Page.enable')
  await win.webContents.debugger.sendCommand('Page.setInterceptFileChooserDialog', {enabled: true})
  const chooser = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Import button did not open a file chooser')), 10000)
    const listener = (_event, method, params) => {
      if (method !== 'Page.fileChooserOpened') return
      clearTimeout(timeout)
      win.webContents.debugger.removeListener('message', listener)
      resolve(params)
    }
    win.webContents.debugger.on('message', listener)
  })
  await win.webContents.executeJavaScript("document.querySelector('#studio-import-model').click()", true)
  const {backendNodeId} = await chooser
  await win.webContents.debugger.sendCommand('DOM.setFileInputFiles', {files: [modelFile], backendNodeId})
  win.webContents.debugger.detach()
  await waitFor("!!document.querySelector('[title=\"offline-model.glb\"]')")
  assert.deepEqual(await fs.readFile(path.join(project.projectPath, 'src/assets/offline-model.glb')), model)
  // Drag the imported asset into the editor through its normal React handlers.
  await evaluate(`(() => {
    const row = document.querySelector('[title="offline-model.glb"]').closest('button');
    const dataTransfer = new DataTransfer();
    row.dispatchEvent(new DragEvent('dragstart', {bubbles:true, dataTransfer}));
    const canvas = document.querySelector('#studio-scene-viewport canvas');
    const bounds = canvas.getBoundingClientRect();
    canvas.dispatchEvent(new DragEvent('drop', {bubbles:true, cancelable:true, dataTransfer,
      clientX:bounds.left + bounds.width / 2, clientY:bounds.top + bounds.height / 2}));
  })()`)
  await waitFor(`(async () => {
    const r = await fetch('file-sync:///file?appKey=${project.appKey}&path=.expanse.json');
    return r.ok && (await r.text()).includes('assets/offline-model.glb');
  })()`)
  const sceneFile = path.join(project.projectPath, 'src/.expanse.json')
  assert.match(await fs.readFile(sceneFile, 'utf8'), /assets\/offline-model\.glb/)
  await waitFor(`(async () => {
    const r = await fetch('file-sync:///project/project-status?appKey=${project.appKey}');
    const status = await r.json(); return Boolean(status.buildUrl);
  })()`, 240000)
  const status = await evaluate(`fetch('file-sync:///project/project-status?appKey=${project.appKey}').then(r=>r.json())`)
  const preview = await fetch(status.buildUrl)
  assert.equal(preview.status, 200, 'packaged local preview responds')
  assert.ok((await preview.text()).includes('runtime.js'))
  const previewAsset = await fetch(`${status.buildUrl}/assets/offline-model.glb`)
  assert.equal(previewAsset.status, 200)
  assert.deepEqual(Buffer.from(await previewAsset.arrayBuffer()), model)
  await waitFor("document.querySelector('#studio-debug-sessions-menu-play-pause-button')")
  await evaluate("document.querySelector('#studio-debug-sessions-menu-play-pause-button').click()")
  let previewRendered = false
  const previewDeadline = Date.now() + 120000
  while (Date.now() < previewDeadline) {
    const frame = win.webContents.mainFrame.framesInSubtree.find(f => f.url.startsWith(status.buildUrl))
    previewRendered = frame && await frame.executeJavaScript(`Boolean(window.ecs &&
      Array.from(document.querySelectorAll('canvas')).some(c => c.width > 0 && c.height > 0) &&
      performance.getEntriesByType('resource').some(r => r.name.includes('offline-model.glb')))`)
      .catch(() => false)
    if (previewRendered) break
    await new Promise(resolve => setTimeout(resolve, 300))
  }
  assert.ok(previewRendered, `Play must load the model in the embedded preview: ${JSON.stringify({
    frames: win.webContents.mainFrame.framesInSubtree.map(f => f.url), blocked,
  })}`)
  await fs.writeFile(path.join(output, 'editor.png'), (await win.webContents.capturePage()).toPNG())
  // Reload verifies that imported assets and scene references were persisted, not just in memory.
  win.webContents.reload()
  // Desktop routing is in memory: a full reload returns to the project list.
  await waitFor("document.querySelector('#app-search')")
  win.webContents.send('navigate-to-path', `/local-studio/${project.appKey}`)
  await waitFor("document.querySelector('[title=\"offline-model.glb\"]') && document.querySelector('#studio-scene-viewport canvas')")
  assert.match(await fs.readFile(sceneFile, 'utf8'), /assets\/offline-model\.glb/)
  const zipBase64 = await evaluate(`(async () => {
    const r = await fetch('file-sync:///project/build?appKey=${project.appKey}', {method:'POST'});
    if (!r.ok) throw new Error(await r.text());
    return new Promise(resolve => {
      r.blob().then(blob => { const reader = new FileReader(); reader.onload=()=>resolve(reader.result.split(',')[1]); reader.readAsDataURL(blob); });
    });
  })()`)
  const zipData = Buffer.from(zipBase64, 'base64')
  const zip = await JsZip.loadAsync(zipData)
  const exportedModel = Object.keys(zip.files).find(name => name.endsWith('assets/offline-model.glb'))
  assert.ok(exportedModel, 'model included in project ZIP')
  assert.deepEqual(await zip.file(exportedModel).async('nodebuffer'), model)
  assert.equal(blocked.length, 0, 'core flow must not request external web services')
  const result = {passed: true, packaged: app.isPackaged, version: app.getVersion(),
    modelImported: true, scenePersisted: true, previewRendered,
    preview: status.buildUrl, zipSize: zipData.length, blocked}
  await fs.writeFile(path.join(output, 'result.json'), JSON.stringify(result, null, 2))
  await evaluate(`fetch('file-sync:///project/watch-local?appKey=${project.appKey}', {method:'DELETE'})`)
  console.log('STANDALONE_SMOKE_PASSED', result)
  app.exit(0)
}
main().catch(async error => {
  console.error(error)
  await fs.mkdir(output, {recursive: true})
  await fs.writeFile(path.join(output, 'failure.txt'), String(error.stack || error))
  if (win && !win.isDestroyed()) {
    await fs.writeFile(path.join(output, 'failure.png'), (await win.webContents.capturePage()).toPNG())
    await fs.writeFile(path.join(output, 'page.txt'), await win.webContents.executeJavaScript('document.body.innerText'))
  }
  app.exit(1)
})

// Run with Electron, using an isolated profile and temporary projects.
const {app, BrowserWindow, session, dialog} = require('electron')
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const assert = require('node:assert/strict')

async function main() {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), '8w-standalone-smoke-'))
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
  // Register this before the app's ready callback. No external network is allowed.
  app.whenReady().then(() => session.defaultSession.webRequest.onBeforeRequest(
    {urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*']}, (details, callback) => {
      const local = ['localhost', '127.0.0.1', '[::1]'].includes(new URL(details.url).hostname)
      if (!local) blocked.push(details.url)
      callback({cancel: !local})
    }))
  require('../dist/start.js')
  await app.whenReady()
  const win = BrowserWindow.getAllWindows()[0]
  assert.ok(win, 'desktop window created')
  const evaluate = code => win.webContents.executeJavaScript(code)
  async function waitFor(code, timeout = 120000) {
    const end = Date.now() + timeout
    while (Date.now() < end) {
      if (await evaluate(code).catch(() => false)) return
      await new Promise(resolve => setTimeout(resolve, 300))
    }
    throw new Error(`Timed out waiting for: ${code}\n${await evaluate('document.body.innerText')}`)
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
  await waitFor("document.body.innerText.includes('方塊') && Array.from(document.querySelectorAll('canvas')).some(c => c.width > 0 && c.height > 0)")
  await waitFor(`(async () => {
    const r = await fetch('file-sync:///project/project-status?appKey=${project.appKey}');
    const status = await r.json(); return Boolean(status.buildUrl);
  })()`, 240000)
  const zipSize = await evaluate(`(async () => {
    const r = await fetch('file-sync:///project/build?appKey=${project.appKey}', {method:'POST'});
    if (!r.ok) throw new Error(await r.text()); return (await r.arrayBuffer()).byteLength;
  })()`)
  assert.ok(zipSize > 1000, 'offline project export')
  await fs.mkdir('out/standalone-smoke', {recursive: true})
  await fs.writeFile('out/standalone-smoke/editor.png', (await win.webContents.capturePage()).toPNG())
  await fs.writeFile('out/standalone-smoke/result.json', JSON.stringify({passed: true, zipSize, blocked}, null, 2))
  await evaluate(`fetch('file-sync:///project/watch-local?appKey=${project.appKey}', {method:'DELETE'})`)
  console.log('STANDALONE_SMOKE_PASSED', {zipSize, blocked})
  // Profile may remain locked until Electron exits; all test data is under the OS temp folder.
  app.exit(0)
}
main().catch(error => {console.error(error); app.exit(1)})

const fs = require('node:fs/promises')
const path = require('node:path')
const {build} = require('esbuild')
const JsZip = require('jszip')
const root = path.resolve(__dirname, '..')
const repo = path.resolve(root, '../..')

async function main() {
  await fs.mkdir(path.join(root, 'dist'), {recursive: true})
  const common = {
    absWorkingDir: root, bundle: true, platform: 'node', format: 'cjs', target: 'node22',
    packages: 'external', alias: {'@repo': repo},
    define: {'process.env.DEPLOY_STAGE': '"dev"', 'process.env.STANDALONE_MODE': '"1"',
      'import.meta.url': '__filename'},
    logLevel: 'info',
  }
  await build({...common, entryPoints: ['src/shell/start.ts'], outfile: 'dist/start.js'})
  await fs.copyFile(path.join(repo, 'apps/image-target-cli/src/constants.json'),
    path.join(root, 'dist/constants.json'))
  await build({...common, packages: undefined, external: ['electron'],
    entryPoints: ['src/shell/preload.ts'], outfile: 'dist/preload.js'})
  await fs.writeFile(path.join(root, 'dist/_start.js'), `
process.env.DEPLOY_STAGE = 'dev'
process.env.STANDALONE_MODE = '1'
const {app, dialog} = require('electron')
const path = require('node:path')
app.setName('8th Wall 繁體中文單機版')
app.setPath('userData', path.join(app.getPath('appData'), '8thWall-Standalone-TW'))
try {
  require(process.argv.includes('--standalone-smoke-test') ? './standalone-smoke.cjs' : './start.js')
} catch (error) {
  dialog.showErrorBox('工作室啟動失敗', String(error.stack || error))
  app.exit(1)
}
`)
  await fs.copyFile(path.join(root, 'tools/standalone-smoke.cjs'),
    path.join(root, 'dist/standalone-smoke.cjs'))

  const template = path.join(root, 'new-project')
  const zip = new JsZip()
  async function addFolder(relative) {
    for (const entry of await fs.readdir(path.join(template, relative), {withFileTypes: true})) {
      const name = path.posix.join(relative, entry.name)
      if (entry.name === 'BUILD') continue
      if (entry.isDirectory()) await addFolder(name)
      else if (entry.isFile()) zip.file(name, await fs.readFile(path.join(template, name)))
    }
  }
  for (const name of ['package.json', 'package-lock.json', 'tsconfig.json']) {
    zip.file(name, await fs.readFile(path.join(template, name)))
  }
  await addFolder('src')
  await addFolder('config')
  const scene = JSON.parse(await zip.file('src/.expanse.json').async('string'))
  const names = {'Ambient Light': '環境光', Box: '方塊', Camera: '攝影機', 'Directional Light': '平行光'}
  for (const object of Object.values(scene.objects)) object.name = names[object.name] || object.name
  for (const space of Object.values(scene.spaces || {})) space.name = '預設場景'
  zip.file('src/.expanse.json', JSON.stringify(scene, null, 2))
  const resources = path.join(root, 'build_package')
  await fs.mkdir(resources, {recursive: true})
  await fs.writeFile(path.join(resources, 'new-project.zip'),
    await zip.generateAsync({type: 'nodebuffer', compression: 'DEFLATE'}))
  const offline = path.join(resources, 'offline-template')
  await fs.mkdir(offline, {recursive: true})
  for (const name of ['package.json', 'package-lock.json']) {
    await fs.copyFile(path.join(template, name), path.join(offline, name))
  }
  // Recreate generated dependencies only, never a user's project directory.
  await fs.rm(path.join(offline, 'node_modules'), {recursive: true, force: true})
  await fs.cp(path.join(template, 'node_modules'), path.join(offline, 'node_modules'), {
    recursive: true, dereference: true,
    filter: source => !source.split(path.sep).includes('.bin'),
  })
  console.log('單機程式與離線專案套件已準備完成。')
}
main().catch(error => {console.error(error); process.exitCode = 1})

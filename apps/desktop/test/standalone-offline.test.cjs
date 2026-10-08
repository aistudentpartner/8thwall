const {test} = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const {buildSync} = require('esbuild')
const {Module} = require('node:module')

const compiled = buildSync({entryPoints: [path.join(__dirname, '../src/project/offline-dependencies.ts')],
  bundle: true, platform: 'node', format: 'cjs', write: false}).outputFiles[0].text
const moduleInstance = new Module(__filename)
moduleInstance.paths = module.paths
moduleInstance._compile(compiled, __filename)
const {ensureOfflineDependencies} = moduleInstance.exports

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), '8w 單機測試 '))
  t.after(() => fs.rm(root, {recursive: true, force: true}))
  const template = path.join(root, 'template'), project = path.join(root, '我的專案')
  await fs.mkdir(path.join(template, 'node_modules/demo'), {recursive: true})
  await fs.mkdir(project)
  const pkg = {dependencies: {demo: '1.0.0'}, devDependencies: {}}
  for (const dir of [template, project]) await fs.writeFile(path.join(dir, 'package.json'), JSON.stringify(pkg))
  await fs.writeFile(path.join(template, 'package-lock.json'), '{}')
  await fs.writeFile(path.join(template, 'node_modules/demo/package.json'), '{"version":"1.0.0"}')
  await fs.writeFile(path.join(template, 'node_modules/demo/index.js'), 'module.exports = 42')
  await fs.writeFile(path.join(project, 'scene.json'), 'keep my scene')
  return {root, template, project}
}

test('a new project receives local dependencies without changing its files', async t => {
  const {project, template} = await fixture(t)
  await ensureOfflineDependencies(project, template)
  assert.equal(require(path.join(project, 'node_modules/demo')), 42)
  assert.equal(await fs.readFile(path.join(project, 'scene.json'), 'utf8'), 'keep my scene')
  await fs.rm(template, {recursive: true})
  // On subsequent opens only metadata is required; no install command or network is used.
})

test('reopening preserves installed packages and locally added files', async t => {
  const {project, template} = await fixture(t)
  await ensureOfflineDependencies(project, template)
  await fs.writeFile(path.join(project, 'node_modules/demo/index.js'), 'module.exports = 77')
  await ensureOfflineDependencies(project, template)
  assert.equal(await fs.readFile(path.join(project, 'node_modules/demo/index.js'), 'utf8'), 'module.exports = 77')
})

test('missing custom dependencies fail clearly without changing the project', async t => {
  const {project, template} = await fixture(t)
  await fs.writeFile(path.join(project, 'package.json'), '{"dependencies":{"custom":"2.0.0"}}')
  await assert.rejects(ensureOfflineDependencies(project, template), /額外套件/)
  assert.equal(await fs.readFile(path.join(project, 'scene.json'), 'utf8'), 'keep my scene')
  await assert.rejects(fs.access(path.join(project, 'node_modules')))
})

test('completing a partial install preserves unrelated packages', async t => {
  const {project, template} = await fixture(t)
  await fs.mkdir(path.join(project, 'node_modules/user-package'), {recursive: true})
  await fs.writeFile(path.join(project, 'node_modules/user-package/note.txt'), 'preserve')
  await ensureOfflineDependencies(project, template)
  assert.equal(await fs.readFile(path.join(project, 'node_modules/user-package/note.txt'), 'utf8'), 'preserve')
  assert.equal(require(path.join(project, 'node_modules/demo')), 42)
})

test('already installed custom dependencies can run offline', async t => {
  const {project, template} = await fixture(t)
  await fs.writeFile(path.join(project, 'package.json'), '{"dependencies":{"custom":"2.0.0"}}')
  await fs.mkdir(path.join(project, 'node_modules/custom'), {recursive: true})
  await fs.writeFile(path.join(project, 'node_modules/custom/package.json'), '{"version":"2.0.0"}')
  await ensureOfflineDependencies(project, template)
  await assert.rejects(fs.access(path.join(project, 'node_modules/demo')))
})

test('an incomplete application bundle explains how to recover without changing project files', async t => {
  const {project, template} = await fixture(t)
  await fs.rm(path.join(template, 'node_modules'), {recursive: true})
  await assert.rejects(ensureOfflineDependencies(project, template), /安裝檔缺少離線預覽套件/)
  assert.equal(await fs.readFile(path.join(project, 'scene.json'), 'utf8'), 'keep my scene')
  await assert.rejects(fs.access(path.join(project, 'node_modules')))
})

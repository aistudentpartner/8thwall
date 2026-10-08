import fs from 'node:fs/promises'
import path from 'node:path'
import {createHash} from 'node:crypto'

const dependencySet = (pkg: any) => JSON.stringify(Object.entries({
  ...pkg.dependencies, ...pkg.devDependencies,
}).sort(([a], [b]) => a.localeCompare(b)))

// The published dev8 HUD injects Google Fonts links whenever preview opens.
// Use its existing monospace fallback in standalone mode, including older projects.
const prepareOfflinePreview = async (modules: string) => {
  const dev8 = path.join(modules, '@8thwall/ecs/dev8/dev8.js')
  let source: string
  try {
    source = await fs.readFile(dev8, 'utf8')
  } catch (error: any) {
    if (error.code === 'ENOENT') return
    throw error
  }
  const offline = source.replace(/<link\b[^>]*https:\/\/fonts\.(?:googleapis|gstatic)\.com[^>]*>/g, '')
  if (offline !== source) await fs.writeFile(dev8, offline)
}

// Only copy the bundled dependency set into compatible projects. Opening a project
// never downloads or upgrades packages; a deliberate Install action still can.
const ensureOfflineDependencies = async (projectDir: string, templateDir: string) => {
  const [project, template, lock] = await Promise.all([
    fs.readFile(path.join(projectDir, 'package.json'), 'utf8').then(JSON.parse),
    fs.readFile(path.join(templateDir, 'package.json'), 'utf8').then(JSON.parse),
    fs.readFile(path.join(templateDir, 'package-lock.json')),
  ])
  const modules = path.join(projectDir, 'node_modules')
  const required = Object.keys({...project.dependencies, ...project.devDependencies})
  const installed = (await Promise.all(required.map(name =>
    fs.access(path.join(modules, name, 'package.json')).then(() => true, () => false))))
    .every(Boolean)
  if (installed) {
    await prepareOfflinePreview(modules)
    return
  }
  if (dependencySet(project) !== dependencySet(template)) {
    throw new Error('此專案需要額外套件。請連線後在專案選單執行「安裝套件」，完成後即可離線開啟。')
  }
  try {
    await fs.access(path.join(templateDir, 'node_modules'))
  } catch {
    throw new Error('安裝檔缺少離線預覽套件。請更新單機版後重新開啟專案；不需要連線至雲端伺服器。')
  }
  const staging = path.join(projectDir, `.standalone-deps-${createHash('sha256').update(lock).digest('hex').slice(0, 12)}`)
  await fs.rm(staging, {recursive: true, force: true})
  try {
    await fs.cp(path.join(templateDir, 'node_modules'), staging, {recursive: true})
    // Preserve any partial/user-installed dependency directory instead of removing it.
    if (await fs.stat(modules).then(() => true, () => false)) {
      await fs.cp(staging, modules, {recursive: true, force: false})
    } else {
      await fs.rename(staging, modules)
    }
  } finally {
    await fs.rm(staging, {recursive: true, force: true})
  }
  await prepareOfflinePreview(modules)
}

export {ensureOfflineDependencies}

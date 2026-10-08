const fs = require('node:fs/promises')
const path = require('node:path')
const assert = require('node:assert/strict')
const {createHash} = require('node:crypto')

const digest = async file => createHash('sha256').update(await fs.readFile(file)).digest('hex')

// Verify every copied file, including transitive dependencies and runtime assets.
async function verifyTree(source, destination) {
  let count = 0
  for (const entry of await fs.readdir(source, {withFileTypes: true})) {
    const from = path.join(source, entry.name)
    const to = path.join(destination, entry.name)
    if (entry.isDirectory()) count += await verifyTree(from, to)
    else {
      assert.equal(await digest(to), await digest(from), `Packaged resource differs: ${to}`)
      count += 1
    }
  }
  return count
}

module.exports = async ({appOutDir, electronPlatformName}) => {
  const root = path.resolve(__dirname, '..')
  const resources = electronPlatformName === 'darwin'
    ? path.join(appOutDir, '8th Wall 繁體中文單機版.app/Contents/Resources')
    : path.join(appOutDir, 'resources')
  for (const [source, target] of [
    ['build_package/offline-template', 'offline-template'],
    ['node_modules/npm', 'app.asar.unpacked/node_modules/npm'],
  ]) {
    const from = path.join(root, source)
    const to = path.join(resources, target)
    await fs.cp(from, to, {recursive: true, dereference: true})
    console.log(`Verified ${await verifyTree(from, to)} packaged files: ${target}`)
  }
  for (const file of [
    'offline-template/node_modules/webpack/bin/webpack.js',
    'offline-template/node_modules/webpack-dev-server/bin/webpack-dev-server.js',
    'offline-template/node_modules/@8thwall/ecs/dist/runtime.js',
    'app.asar.unpacked/node_modules/npm/node_modules/semver/package.json',
  ]) await fs.access(path.join(resources, file))
}

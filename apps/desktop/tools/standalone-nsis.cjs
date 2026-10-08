const fs = require('node:fs/promises')
const path = require('node:path')
const {createHash} = require('node:crypto')
const {execFileSync} = require('node:child_process')

// Pin the official NSIS 3.12 bundle. The legacy 3.0.4.1 System plugin can crash
// during fresh per-user installation (electron-builder issue #7921).
const URL = 'https://github.com/electron-userland/electron-builder-binaries/releases/download/nsis%402.0.1/nsis-bundle-3.12.tar.gz'
const SHA256 = 'fe36a357f3a220db893498e830fd80e0769768a18a99f4e4d2447b982538feed'

module.exports = async ({electronPlatformName}) => {
  if (electronPlatformName !== 'win32') return
  const cache = path.resolve(__dirname, '../build_package/nsis-3.12')
  const archive = path.join(cache, 'nsis-bundle-3.12.tar.gz')
  await fs.mkdir(cache, {recursive: true})
  let bytes = await fs.readFile(archive).catch(() => null)
  if (!bytes || createHash('sha256').update(bytes).digest('hex') !== SHA256) {
    const response = await fetch(URL, {signal: AbortSignal.timeout(60000)})
    if (!response.ok) throw new Error(`NSIS download failed: ${response.status}`)
    bytes = Buffer.from(await response.arrayBuffer())
    if (createHash('sha256').update(bytes).digest('hex') !== SHA256) {
      throw new Error('NSIS bundle checksum mismatch')
    }
    await fs.writeFile(archive, bytes)
  }
  execFileSync('tar', ['--no-same-owner', '-xzf', archive, '-C', cache], {stdio: 'inherit'})
  const bundle = path.join(cache, 'nsis-bundle')
  const nsis = path.join(bundle, 'windows')
  await fs.mkdir(path.join(nsis, 'Bin'), {recursive: true})
  await fs.copyFile(path.join(nsis, 'makensis.exe'), path.join(nsis, 'Bin/makensis.exe'))
  await fs.copyFile(path.join(bundle, 'elevate.exe'), path.join(nsis, 'elevate.exe'))
  // electron-builder 26 expects the legacy directory layout.
  if (process.platform !== 'win32') {
    const platform = process.platform === 'darwin' ? 'mac' : 'linux'
    await fs.mkdir(path.join(nsis, platform), {recursive: true})
    await fs.copyFile(path.join(bundle, platform, process.arch, 'makensis'),
      path.join(nsis, platform, 'makensis'))
  }
  process.env.ELECTRON_BUILDER_NSIS_DIR = nsis
  console.log('Using verified NSIS 3.12 installer toolchain')
}

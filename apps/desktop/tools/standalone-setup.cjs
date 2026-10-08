const path = require('node:path')
const {execFileSync} = require('node:child_process')
const {runNpm} = require('../../../reality/cloud/xrhome/scripts/run-npm.cjs')
const repo = path.resolve(__dirname, '../../..')
const cwd = path.join(repo, 'apps/desktop')
try {
  if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('請安裝 Node.js 22 以上版本。')
  execFileSync('git', ['lfs', 'pull', '--include=apps/desktop/assets/**,reality/cloud/xrhome/src/client/**'], {
    cwd: repo, stdio: 'inherit',
  })
  runNpm(['ci', '--ignore-scripts', '--no-audit', '--no-fund'], {cwd, stdio: 'inherit'})
  // Install only the required build/runtime binaries, then rebuild native SQLite for Electron.
  execFileSync(process.execPath, ['node_modules/electron/install.js'], {cwd, stdio: 'inherit'})
  execFileSync(process.execPath, ['node_modules/esbuild/install.js'], {cwd, stdio: 'inherit'})
  runNpm(['exec', '--', 'electron-builder', 'install-app-deps'], {cwd, stdio: 'inherit'})
  runNpm(['ci', '--legacy-peer-deps', '--no-audit', '--no-fund'], {
    cwd: path.join(repo, 'reality/cloud/xrhome'), stdio: 'inherit',
  })
  runNpm(['ci', '--no-audit', '--no-fund'], {cwd: path.join(cwd, 'new-project'), stdio: 'inherit'})
  runNpm(['run', 'standalone:build'], {cwd, stdio: 'inherit'})
  console.log('\n安裝完成。請執行 Start-Standalone.cmd。')
} catch (error) {
  console.error('\n單機版安裝未完成：', error.message)
  process.exitCode = 1
}

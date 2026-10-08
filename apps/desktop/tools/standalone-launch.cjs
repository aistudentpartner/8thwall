const fs = require('node:fs')
const path = require('node:path')
const {spawn} = require('node:child_process')
const root = path.resolve(__dirname, '..')
try {
  if (!fs.existsSync(path.join(root, 'dist/_start.js'))) throw new Error('請先執行 Setup-Standalone.cmd。')
  const executable = require('electron')
  const env = {...process.env}
  delete env.ELECTRON_RUN_AS_NODE
  const child = spawn(executable, ['.', ...process.argv.slice(2)], {cwd: root, stdio: 'inherit', env})
  child.on('error', error => {console.error(error); process.exitCode = 1})
  child.on('exit', code => {process.exitCode = code === null ? 1 : code})
} catch (error) {
  console.error('無法啟動單機工作室：', error.message)
  process.exitCode = 1
}

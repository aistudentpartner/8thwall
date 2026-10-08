const {execFileSync} = require('node:child_process')

// npm run supplies the CLI path, including installations under Program Files.
// Execute that JavaScript file with Node: npm.cmd cannot be launched directly
// by execFileSync on Windows, and shell quoting is unnecessary here.
const runNpm = (args, options = {}) => {
  const env = options.env || process.env
  const npmCli = env.npm_execpath
  if (!npmCli) {
    throw new Error('Run this build with: npm run build:web --prefix reality/cloud/xrhome')
  }
  return execFileSync(process.execPath, [npmCli, ...args], options)
}

module.exports = {runNpm}

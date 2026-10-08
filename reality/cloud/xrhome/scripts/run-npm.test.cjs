const {test} = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const {runNpm} = require('./run-npm.cjs')

test('runs a CLI in a path with spaces without npm on PATH or shell expansion', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), '8w npm cli '))
  const npmCli = path.join(root, 'npm-cli.cjs')
  try {
    fs.writeFileSync(npmCli,
      'console.log(JSON.stringify({args: process.argv.slice(2), cwd: process.cwd()}))')
    const args = ['ci', '--ignore-scripts', 'literal & argument', 'space in value']
    const result = runNpm(args, {
      cwd: root,
      env: {...process.env, PATH: '', Path: '', npm_execpath: npmCli},
      encoding: 'utf8',
    })
    assert.deepEqual(JSON.parse(result), {args, cwd: fs.realpathSync(root)})
  } finally {
    fs.rmSync(root, {recursive: true, force: true})
  }
})

test('stops the build when npm exits unsuccessfully', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), '8w npm failure '))
  const npmCli = path.join(root, 'npm-cli.cjs')
  try {
    fs.writeFileSync(npmCli, 'process.exit(23)')
    assert.throws(() => runNpm(['ci'], {
      env: {...process.env, npm_execpath: npmCli}, stdio: 'pipe',
    }), error => error.status === 23)
  } finally {
    fs.rmSync(root, {recursive: true, force: true})
  }
})

test('explains how to launch the build when it was not started through npm', () => {
  assert.throws(() => runNpm(['ci'], {env: {}}), /npm run build:web --prefix/)
})

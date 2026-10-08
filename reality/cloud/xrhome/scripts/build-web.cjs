// Build the browser editor without invoking the desktop/Bazel toolchain.
const fs = require('node:fs')
const path = require('node:path')
const {execFileSync} = require('node:child_process')
process.chdir(path.resolve(__dirname, '..'))
require('ts-node').register({transpileOnly: true})
const webpack = require('webpack')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const desktopConfig = require('../webpack.desktop').default
const workerConfig = require('../webpack.worker').default
const {getBuildIfReplacements} = require('../src/shared/buildif')

const production = process.argv.includes('--production')
const out = path.resolve('web-dist')
const replace = (search, value) => ({search, replace: JSON.stringify(value), flags: 'g'})
const replacements = getBuildIfReplacements({
  isLocalDev: false, isRemoteDev: false, isTest: false, flagLevel: 'mature',
}).map(({flag, value}) => replace(`BuildIf.${flag}`, value))
replacements.push(...Object.entries({
  VERSION_ID: 'web-editor', EXECUTABLE_NAME: 'console-client',
  DEPLOYMENT_PATH: 'static/web', PLATFORM_TARGET: 'web',
}).map(([key, value]) => replace(`Build8.${key}`, value)))
const options = {
  isProduction: production, isLocalDev: false, replacements,
  extraPlugins: [], allowSymlinkToExternal: true,
}

if (!fs.existsSync('semantic/dist/semantic.min.css')) {
  execFileSync('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], {
    cwd: 'semantic', stdio: 'inherit',
  })
  execFileSync(process.execPath, ['node_modules/gulp/bin/gulp.js', 'build'], {
    cwd: 'semantic', stdio: 'inherit',
  })
}
fs.cpSync('semantic/dist', 'src/client/static/semantic/dist', {recursive: true})
fs.mkdirSync(out, {recursive: true})
const resources = path.resolve('../../../apps/web/node_modules/@8thwall/ecs/dist/resources')
if (!fs.existsSync(resources)) {
  throw new Error('Run npm ci --prefix apps/web from the repository root before building.')
}
fs.cpSync(resources, path.join(out, 'ecs-resources'), {recursive: true})
const app = desktopConfig(options)
app.entry = {web: './src/client/web/index.tsx'}
app.output = {...app.output, path: out, publicPath: '/'}
app.plugins = app.plugins.filter(plugin => !(plugin instanceof HtmlWebpackPlugin))
app.plugins.push(new HtmlWebpackPlugin({template: './src/client/web/index.html'}))
app.devtool = production ? false : 'source-map'
const workers = workerConfig({...options, deploymentPath: 'static/web', distPath: 'web-dist'})
webpack([app, workers], (error, stats) => {
  if (error) { console.error(error); process.exitCode = 1; return }
  console.log(stats.toString({all: false, errors: true, warnings: true, timings: true}))
  if (stats.hasErrors()) process.exitCode = 1
})

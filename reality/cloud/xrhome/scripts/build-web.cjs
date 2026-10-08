// Build the browser editor without invoking the desktop/Bazel toolchain.
const fs = require('node:fs')
const path = require('node:path')
const {execFileSync} = require('node:child_process')
const {runNpm} = require('./run-npm.cjs')
const {configureRepoLinks} = require('./repo-links.cjs')
process.chdir(path.resolve(__dirname, '..'))
require('ts-node').register({transpileOnly: true})
const webpack = require('webpack')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const desktopConfig = require('../webpack.desktop').default
const workerConfig = require('../webpack.worker').default
const {getBuildIfReplacements} = require('../src/shared/buildif')

const production = process.argv.includes('--production')
const standalone = process.argv.includes('--standalone')
const distName = standalone ? 'desktop-dist' : 'web-dist'
const deploymentPath = standalone ? 'static/standalone' : 'static/web'
const out = path.resolve(distName)
const replace = (search, value) => ({search, replace: JSON.stringify(value), flags: 'g'})
const replacements = getBuildIfReplacements({
  isLocalDev: false, isRemoteDev: false, isTest: false, flagLevel: 'mature',
}).map(({flag, value}) => replace(`BuildIf.${flag}`, value))
replacements.push(...Object.entries({
  VERSION_ID: standalone ? 'standalone-tw' : 'web-editor', EXECUTABLE_NAME: 'console-client',
  DEPLOYMENT_PATH: deploymentPath, PLATFORM_TARGET: standalone ? 'desktop' : 'web',
}).map(([key, value]) => replace(`Build8.${key}`, value)))
const options = {
  isProduction: production, isLocalDev: false, replacements,
  extraPlugins: [], allowSymlinkToExternal: true,
}

if (!fs.existsSync('semantic/dist/semantic.min.css')) {
  runNpm(['ci', '--ignore-scripts', '--no-audit', '--no-fund'], {
    cwd: 'semantic', stdio: 'inherit',
  })
  execFileSync(process.execPath, ['node_modules/gulp/bin/gulp.js', 'build'], {
    cwd: 'semantic', stdio: 'inherit',
  })
}
fs.cpSync('semantic/dist', 'src/client/static/semantic/dist', {recursive: true})
// Fonts are optional decoration; the offline editor uses locally installed fonts.
const semanticCss = 'src/client/static/semantic/dist/semantic.min.css'
fs.writeFileSync(semanticCss, fs.readFileSync(semanticCss, 'utf8')
  .replace(/@import\s+url\(https:\/\/fonts\.googleapis\.com\/[^;]+;/g, ''))
fs.mkdirSync(out, {recursive: true})
const resources = path.resolve(standalone
  ? '../../../apps/desktop/new-project/node_modules/@8thwall/ecs/dist/resources'
  : '../../../apps/web/node_modules/@8thwall/ecs/dist/resources')
if (!fs.existsSync(resources)) {
  throw new Error(`Run npm ci --prefix ${standalone ? 'apps/desktop/new-project' : 'apps/web'} before building.`)
}
fs.cpSync(resources, path.join(out, 'ecs-resources'), {recursive: true})
const app = desktopConfig(options)
app.entry = standalone ? {desktop: './src/client/desktop/index.tsx'} : {web: './src/client/web/index.tsx'}
app.output = {...app.output, path: out, publicPath: standalone ? 'desktop://dist/' : '/'}
app.plugins = app.plugins.filter(plugin => !(plugin instanceof HtmlWebpackPlugin))
app.plugins.push(new HtmlWebpackPlugin({template: './src/client/startup/index.html',
  studioRootId: standalone ? 'xrhome-desktop-root' : 'xrhome-web-root'}))
app.devtool = production ? false : 'source-map'
const workerPath = standalone ? 'worker' : deploymentPath
const workers = workerConfig({...options, deploymentPath: workerPath, distPath: distName})
workers.output.filename = `${workerPath}/client/[name]-worker.js`
const wasmRule = workers.module.rules.find(rule => rule.test?.toString() === '/\\.wasm$/')
if (wasmRule) wasmRule.options.name = `${workerPath}/[name].[ext]`
if (standalone) workers.output.publicPath = 'desktop://dist/'
configureRepoLinks(app, webpack)
configureRepoLinks(workers, webpack)
webpack([app, workers], (error, stats) => {
  if (error) { console.error(error); process.exitCode = 1; return }
  console.log(stats.toString({all: false, errors: true, warnings: true, timings: true}))
  if (stats.hasErrors()) process.exitCode = 1
})

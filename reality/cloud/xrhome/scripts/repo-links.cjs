const path = require('node:path')

// Windows Git may check these links out as text files (core.symlinks=false).
// Resolve their targets in the bundler without changing the user's checkout.
const xrhome = path.resolve(__dirname, '..')
const repo = path.resolve(xrhome, '../../..')
const links = [
  ['desktop', 'reality/shared/desktop'],
  ['ecs', 'c8/ecs/src'],
  ['nae', 'reality/shared/nae'],
  ['studio', 'reality/shared/studio'],
  ['typed-attributes.ts', 'reality/shared/typed-attributes.ts'],
].map(([source, target]) => [path.join(xrhome, 'src/shared', source), path.join(repo, target)])

const resolveRepoLink = (filename) => {
  for (const [source, target] of links) {
    if (filename === source || filename.startsWith(`${source}${path.sep}`)) {
      return target + filename.slice(source.length)
    }
  }
  return filename
}

const configureRepoLinks = (config, webpack) => {
  config.resolve.alias = Object.fromEntries(Object.entries(config.resolve.alias || {})
    .map(([key, value]) => [key, typeof value === 'string' ? resolveRepoLink(value) : value]))
  config.plugins.push(new webpack.NormalModuleReplacementPlugin(/./, (resource) => {
    const request = resource.request
    if (!request.startsWith('.') && !path.isAbsolute(request)) return
    const filename = path.resolve(resource.context, request)
    const target = resolveRepoLink(filename)
    if (target !== filename) resource.request = target
  }))
}

module.exports = {configureRepoLinks, resolveRepoLink}

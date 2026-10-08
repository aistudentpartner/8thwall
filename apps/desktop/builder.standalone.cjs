module.exports = {
  appId: 'org.aistudentpartner.8thwall.standalone',
  productName: '8th Wall 繁體中文單機版',
  executableName: '8thWall-Standalone-TW',
  artifactName: '8thWall-TW-Setup-${version}-${arch}.${ext}',
  directories: {output: 'out/standalone'},
  files: ['dist/**/*', 'package.json', '!node_modules/npm/**/*'],
  extraResources: [
    {from: '../../reality/cloud/xrhome/desktop-dist', to: 'desktop-dist'},
    {from: 'build_package/new-project.zip', to: 'new-project.zip'},
  ],
  // extraResources prunes nested node_modules; these are complete executable toolchains.
  afterPack: require('./tools/standalone-after-pack.cjs'),
  asar: true,
  asarUnpack: ['**/node_modules/better-sqlite3/**/*', '**/node_modules/sharp/**/*', '**/node_modules/@img/**/*'],
  win: {target: [{target: 'nsis', arch: ['x64']}], icon: 'assets/icon.ico', signAndEditExecutable: false},
  nsis: {oneClick: false, perMachine: false, allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true, deleteAppDataOnUninstall: false, installerLanguages: ['zh_TW', 'en_US'],
    language: '1028'},
  publish: null,
}

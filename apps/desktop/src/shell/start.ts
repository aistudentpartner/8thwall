// @rule(js_binary)
// @package(npm-desktop)
// @attr(esnext = 1)
// @attr(target = "node")
// @attr(externals = "electron, sharp")

import {app, BrowserWindow, protocol, dialog, ipcMain} from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import {autoUpdater} from 'electron-updater'
import log from 'electron-log'

import {initDb} from '../core/application-state'
import {FILE_SYNC_SCHEME, registerFileSyncHandler} from '../file-sync/protocol'
import {
  DESKTOP_SCHEME, maybeUpdateOnBeforeRequest, registerDesktopAppHandler,
  registerWindowOpenHandler,
} from './protocol'
import {registerOnOpenUrlHandler} from './register-on-open-url-handler'
import {STUDIO_HUB_PROTOCOL} from '../core/desktop-protocol'
import {setUpMainFileWatchPort} from '../file-watch/ports'
import {PREFERENCES_SCHEME, registerPreferencesHandler} from '../preferences/protocol'
import {registerSecondInstanceHandler} from './register-second-instance-handler'
import {registerPermissionHandler} from './permissions'
import {navigateToDeepLink} from './deep-link'
import {setupMenu} from './menu'
import {IMAGE_TARGETS_SCHEME, registerImageTargetsHandler} from '../image-targets/protocol'
import {setUpSystemLogPort} from '../system-log/ports'
import {setupDev8SocketPort} from '../dev8-socket/ports'
import {PRELOAD_PATH, CLIENT_DIST_PATH} from '../core/resources'

const UPDATE_CHECK_INTERVAL = 60 * 60 * 1000

if (process.argv.includes('--software-rendering')) {
  app.disableHardwareAcceleration()
  app.commandLine.appendSwitch('use-angle', 'swiftshader')
  app.commandLine.appendSwitch('enable-unsafe-swiftshader')
}

const setupAutoUpdater = (win: BrowserWindow) => {
  autoUpdater.logger = log

  const appVersion = app.getVersion()
  if (appVersion.includes('-beta')) {
    autoUpdater.channel = 'beta'
  }

  autoUpdater.checkForUpdatesAndNotify()

  setInterval(() => {
    autoUpdater.checkForUpdatesAndNotify()
  }, UPDATE_CHECK_INTERVAL)

  autoUpdater.on('update-downloaded', () => {
    const result = dialog.showMessageBoxSync(win, {
      type: 'info',
      buttons: ['Restart now', 'Later'],
      title: 'Update ready',
      message: 'A new version has been downloaded. Restart now to apply updates?',
    })
    if (result === 0) {
      autoUpdater.quitAndInstall()
    }
  })
}

const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  log.info('Another instance is already running, quitting...')
  app.quit()
  process.exit(0)
}

try {
  // Write to ~/Library/Application Support/desktop (or 8th Wall on prod) on mac
  const userDataPath = app.getPath('userData')
  initDb(userDataPath)
} catch (error) {
  // eslint-disable-next-line no-console
  console.error('Failed to initialize database:', error)
  dialog.showErrorBox('無法開啟本機專案資料庫', String(error))
  process.exit(1)
}

if (process.env.STANDALONE_MODE !== '1') {
  app.commandLine.appendSwitch('ignore-certificate-errors')
}

const createWindow = () => {
  if (!fs.existsSync(path.join(CLIENT_DIST_PATH, 'index.html'))) {
    throw new Error('找不到工作室介面。請先執行 Setup-Standalone.cmd 完成建置。')
  }
  const win = new BrowserWindow({
    width: 1600,
    height: 1200,
    minWidth: 900,
    minHeight: 700,
    webPreferences: {
      preload: PRELOAD_PATH,
      devTools: !process.env.RELEASE,
      contextIsolation: true,
      nodeIntegration: false,
    },
    frame: false,
    title: app.getName(),
    titleBarStyle: 'hidden',
    ...(process.platform !== 'darwin'
      ? {
        titleBarOverlay: {
          symbolColor: '#ffffff',
          color: '#000000',
        },
      }
      : {
        trafficLightPosition: {x: 10, y: 10},
      }),
    backgroundColor: '#171721',
  })
  win.webContents.on('did-fail-load', (_event, code, description, url, mainFrame) => {
    if (!mainFrame || code === -3) return
    log.error('介面載入失敗', code, description, url)
    dialog.showErrorBox('工作室載入失敗', `${description} (${code})\n${url}\n請使用「檢視 → 開發者工具」查看詳細錯誤。`)
  })
  win.webContents.on('preload-error', (_event, preloadPath, error) => {
    log.error('Preload failed', preloadPath, error)
    dialog.showErrorBox('工作室元件載入失敗', String(error.stack || error))
  })
  win.webContents.on('render-process-gone', (_event, details) => {
    log.error('Renderer stopped', details)
    dialog.showErrorBox('工作室畫面已停止', `原因：${details.reason}\n請重新啟動。若仍為黑畫面，可使用 Start-Standalone-Software.cmd。`)
  })
  win.loadURL(process.env.STANDALONE_MODE === '1'
    ? 'desktop://dist/index.html?lang=zh-TW' : 'desktop://dist/index.html')
  registerWindowOpenHandler(win)
  registerOnOpenUrlHandler(win)
  registerSecondInstanceHandler(win)
  registerPermissionHandler(win)

  // IPC handlers for window controls
  ipcMain.on('minimize-window', () => {
    win.minimize()
  })
  ipcMain.on('maximize-window', () => {
    if (win.isMaximized()) {
      win.unmaximize()
    } else {
      win.maximize()
    }
  })

  ipcMain.on('close-window', () => {
    win.close()
  })
  return win
}

app.on('window-all-closed', () => {
  app.quit()
})

protocol.registerSchemesAsPrivileged([
  DESKTOP_SCHEME,
  FILE_SYNC_SCHEME,
  PREFERENCES_SCHEME,
  IMAGE_TARGETS_SCHEME,
])

// NOTE(johnny): Remove trailing colon
const protocolName = STUDIO_HUB_PROTOCOL.slice(0, -1)
log.info('Registering as default protocol client for:', protocolName)
log.info('Current platform:', process.platform)

if (process.env.STANDALONE_MODE === '1') {
  log.info('Standalone: keeping the installed 8th Wall protocol association unchanged')
} else if (app.setAsDefaultProtocolClient(protocolName)) {
  log.info('Successfully registered as default protocol client')
} else {
  log.error('Failed to register as default protocol client')
}

const handleReady = () => {
  registerDesktopAppHandler()
  registerFileSyncHandler()
  registerPreferencesHandler()
  registerImageTargetsHandler()
  if (process.env.STANDALONE_MODE !== '1') maybeUpdateOnBeforeRequest()

  const win = createWindow()

  setupMenu()

  win.webContents.on('did-finish-load', () => {
    setUpMainFileWatchPort(win)
    setUpSystemLogPort(win)
    setupDev8SocketPort(win)
    navigateToDeepLink(win, process.argv.pop() || '')
  })

  if (app.isPackaged && process.env.STANDALONE_MODE !== '1') {
    setupAutoUpdater(win)
  }
}

app.whenReady().then(handleReady).catch((error) => {
  log.error('Startup failed', error)
  dialog.showErrorBox('工作室啟動失敗', String(error.stack || error))
  app.quit()
})

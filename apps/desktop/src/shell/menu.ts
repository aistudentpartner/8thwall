import {Menu, MenuItem, shell} from 'electron'
import log from 'electron-log'

const hideToggleDevTools = () => {
  const menu = Menu.getApplicationMenu()
  if (!menu) return

  menu.items.forEach((menuItem) => {
    menuItem.submenu?.items.forEach((subItem) => {
      if (subItem.role?.toLowerCase() === 'toggledevtools') {
        subItem.visible = false
      }
    })
  })

  Menu.setApplicationMenu(menu)
}

const addItemsToFileMenu = () => {
  const menu = Menu.getApplicationMenu()
  if (!menu) return

  // NOTE(dat): although the type for role is fileMenu. When I inspect these items, the roles are
  // stored without captialization, e.g. filemenu, editmenu, viewmenu, etc.
  // https://github.com/electron/electron/issues/46128
  const viewMenu = menu.items.find(item => item.role?.toLowerCase() === 'filemenu')
  if (!viewMenu || !viewMenu.submenu) {
    log.warn('Failed to find File menu to add Show Log item')
    return
  }

  viewMenu.submenu.append(new MenuItem({
    label: 'Show Application Log',
    click: () => {
      shell.showItemInFolder(log.transports.file.getFile()?.path)
    },
  }))
  Menu.setApplicationMenu(menu)
}

const addDevMenu = () => {
  const menu = Menu.getApplicationMenu()
  if (!menu) return
  Menu.setApplicationMenu(menu)
}

const setupMenu = () => {
  if (process.env.STANDALONE_MODE === '1') {
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      {label: '檔案', submenu: [
        {label: '顯示應用程式紀錄', click: () => shell.showItemInFolder(log.transports.file.getFile()?.path)},
        {type: 'separator'}, {label: '結束', role: 'quit'},
      ]},
      {label: '編輯', submenu: [
        {label: '復原', role: 'undo'}, {label: '重做', role: 'redo'}, {type: 'separator'},
        {label: '剪下', role: 'cut'}, {label: '複製', role: 'copy'}, {label: '貼上', role: 'paste'},
        {label: '全選', role: 'selectAll'},
      ]},
      {label: '檢視', submenu: [
        {label: '重新載入', role: 'reload'}, {label: '開發者工具', role: 'toggleDevTools'},
        {label: '全螢幕', role: 'togglefullscreen'},
      ]},
    ]))
    return
  }
  if (process.env.RELEASE) {
    hideToggleDevTools()
  }
  addItemsToFileMenu()

  if (process.env.DEPLOY_STAGE !== 'prod') {
    addDevMenu()
  }
}

export {
  setupMenu,
}

import {
  BrowserWindow,
  BrowserWindowConstructorOptions,
  app,
  shell,
} from 'electron'
import installExtension, {
  REACT_DEVELOPER_TOOLS,
  REDUX_DEVTOOLS,
} from 'electron-devtools-installer'
import Store from 'electron-store'
import { release } from 'os'
import { join } from 'path'
import Realm from 'realm'
import logger from './logger'
import './server'

const isWindows = process.platform === 'win32'
const isMac = process.platform === 'darwin'
const isLinux = process.platform === 'linux'
const isDev = !app.isPackaged

// Disable GPU Acceleration for Windows 7
if (release().startsWith('6.1')) app.disableHardwareAcceleration()

// Set application name for Windows 10+ notifications
if (process.platform === 'win32') app.setAppUserModelId(app.getName())

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

interface TypedElectronStore {
  window: {
    width: number
    height: number
    x?: number
    y?: number
  }
}

const store = new Store<TypedElectronStore>({
  defaults: {
    window: {
      width: 1440,
      height: 960,
    },
  },
})

let win: BrowserWindow | null = null

async function createWindow() {
  // Create window
  const options: BrowserWindowConstructorOptions = {
    title: 'Main window',
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
    },
    width: store.get('window.width'),
    height: store.get('window.height'),
    minWidth: 1080,
    minHeight: 720,
    vibrancy: 'fullscreen-ui',
    titleBarStyle: 'hiddenInset',
  }
  if (store.get('window')) {
    options.x = store.get('window.x')
    options.y = store.get('window.y')
  }
  win = new BrowserWindow(options)

  // Web server
  if (app.isPackaged || process.env['DEBUG']) {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  } else {
    const url = `http://${process.env['VITE_DEV_SERVER_HOST']}:${process.env['VITE_DEV_SERVER_PORT']}`
    logger.info(`[index] Vite dev server running at: ${url}`)

    win.loadURL(url)
    win.webContents.openDevTools()
  }

  // Make all links open with the browser, not with the application
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) shell.openExternal(url)
    return { action: 'deny' }
  })

  // Save window position
  const saveBounds = () => {
    const bounds = win?.getBounds()
    if (bounds) {
      store.set('window', bounds)
    }
  }
  win.on('resized', saveBounds)
  win.on('moved', saveBounds)
}

app.whenReady().then(async () => {
  createWindow()

  // Install devtool extension
  if (isDev) {
    installExtension(REACT_DEVELOPER_TOOLS.id).catch(err =>
      console.log('An error occurred: ', err)
    )
    installExtension(REDUX_DEVTOOLS.id).catch(err =>
      console.log('An error occurred: ', err)
    )
  }
})

app.on('window-all-closed', () => {
  win = null
  if (process.platform !== 'darwin') app.quit()
})

app.on('second-instance', () => {
  if (win) {
    // Focus on the main window if the user tried to open another
    if (win.isMinimized()) win.restore()
    win.focus()
  }
})

app.on('activate', () => {
  const allWindows = BrowserWindow.getAllWindows()
  if (allWindows.length) {
    allWindows[0].focus()
  } else {
    createWindow()
  }
})
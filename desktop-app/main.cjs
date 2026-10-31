const { app, BrowserWindow, ipcMain, net, protocol, session } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createTransactionStore, registerTransactionIpc } = require('./game-storage.cjs');

const APP_ID = 'com.cammowerman.thundercut';
const INTERNAL_SCHEME = 'thunder-cut-app';
const INTERNAL_HOST = 'app';
const INTERNAL_ENTRY = `${INTERNAL_SCHEME}://${INTERNAL_HOST}/index.html`;
const HUB_SCHEME = 'thundercut:';
const SMOKE_TEST = process.env.THUNDER_CUT_SMOKE_TEST === '1';

if (SMOKE_TEST) app.disableHardwareAcceleration();

protocol.registerSchemesAsPrivileged([
  {
    scheme: INTERNAL_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
      codeCache: true,
    },
  },
]);

app.setName('ThunderCut');
app.setAppUserModelId(APP_ID);

const stableUserData = SMOKE_TEST
  ? fs.mkdtempSync(path.join(os.tmpdir(), 'thunder-cut-smoke-'))
  : path.join(app.getPath('appData'), 'CamTheMowerMan', 'ThunderCut');
fs.mkdirSync(stableUserData, { recursive: true });
app.setPath('userData', stableUserData);

let mainWindow = null;
let launchContext = parseLaunchContext(process.argv);

function parseLaunchContext(argv) {
  const uriArgument = argv.find((argument) => argument.toLowerCase().startsWith(HUB_SCHEME));
  if (!uriArgument) return Object.freeze({ contractVersion: 1, source: 'standalone' });

  try {
    const launchUrl = new URL(uriArgument);
    if (launchUrl.protocol !== HUB_SCHEME || launchUrl.hostname !== 'launch') {
      return Object.freeze({ contractVersion: 1, source: 'standalone' });
    }
    const requestId = launchUrl.searchParams.get('requestId');
    const validRequestId = requestId && /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(requestId)
      ? requestId
      : undefined;
    return Object.freeze({
      contractVersion: 1,
      source: launchUrl.searchParams.get('source') === 'hub' ? 'hub' : 'standalone',
      ...(validRequestId ? { requestId: validRequestId } : {}),
    });
  } catch {
    return Object.freeze({ contractVersion: 1, source: 'standalone' });
  }
}

function rendererRoot() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'renderer')
    : path.resolve(__dirname, 'renderer');
}

function resolveRendererFile(requestUrl) {
  const parsedUrl = new URL(requestUrl);
  if (parsedUrl.hostname !== INTERNAL_HOST) return null;

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(parsedUrl.pathname);
  } catch {
    return null;
  }

  const relativePath = decodedPath === '/' ? 'index.html' : decodedPath.replace(/^\/+/, '');
  const root = rendererRoot();
  const candidate = path.resolve(root, relativePath);
  if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) return null;
  if (!fs.existsSync(candidate) || !fs.statSync(candidate).isFile()) return null;
  return candidate;
}

async function handleRendererRequest(request) {
  const filePath = resolveRendererFile(request.url);
  if (!filePath) {
    return new Response('Thunder Cut asset not found.', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }
  return net.fetch(pathToFileURL(filePath).toString());
}

function isInternalNavigation(targetUrl) {
  try {
    const parsedUrl = new URL(targetUrl);
    return parsedUrl.protocol === `${INTERNAL_SCHEME}:` && parsedUrl.hostname === INTERNAL_HOST;
  } catch {
    return false;
  }
}

async function applyFullscreen(next) {
  const window = mainWindow;
  if (!window || window.isDestroyed()) return false;
  window.setFullScreen(next);
  // Wait for the native state before reporting it to the renderer.
  for (let attempt = 0; attempt < 50 && !window.isDestroyed() && window.isFullScreen() !== next; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  if (window.isDestroyed()) return false;
  const fullscreen = window.isFullScreen();
  window.webContents.send('thunder-cut:fullscreen-changed', fullscreen);
  return fullscreen;
}

function createMainWindow() {
  const iconName = process.platform === 'win32' ? 'icon.ico' : 'icon.png';
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked', iconName)
    : path.join(__dirname, iconName);
  mainWindow = new BrowserWindow({
    title: 'ThunderCut',
    width: 1180,
    height: 840,
    minWidth: 960,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#12051f',
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      devTools: !app.isPackaged,
    },
  });

  const notifyFullscreen = () => mainWindow?.webContents.send('thunder-cut:fullscreen-changed', mainWindow.isFullScreen());
  mainWindow.on('enter-full-screen', notifyFullscreen);
  mainWindow.on('leave-full-screen', notifyFullscreen);
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || input.isAutoRepeat) return;
    const fullscreen = mainWindow.isFullScreen();
    if (input.key === 'F11' || (input.key === 'Escape' && fullscreen)) {
      event.preventDefault();
      void applyFullscreen(input.key === 'F11' ? !fullscreen : false);
    }
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, targetUrl) => {
    if (!isInternalNavigation(targetUrl)) event.preventDefault();
  });
  if (!SMOKE_TEST) mainWindow.once('ready-to-show', () => mainWindow?.show());
  if (SMOKE_TEST) {
    mainWindow.webContents.once('did-fail-load', (_event, code, description) => {
      console.error(`THUNDER_CUT_SMOKE_FAIL load ${code}: ${description}`);
      app.exit(1);
    });
    mainWindow.webContents.once('did-finish-load', async () => {
      try {
        const result = await mainWindow.webContents.executeJavaScript(`
          (async () => {
            await new Promise((resolve) => setTimeout(resolve, 350));
            const fetchChecks = await Promise.all([
              fetch('/update-assets/storm-bolt.png').then((response) => response.ok),
              fetch('/audio/thunder-cut/ambience_storm_rain_loop.ogg').then((response) => response.ok),
              fetch('/game-font/a.webp').then((response) => response.ok),
            ]);
            const lineButton = document.querySelector('button[aria-label="Increase active lines"]');
            const spinButton = document.querySelector('.spin-button');
            const fullscreenButton = document.querySelector('.fullscreen-toggle');
            if (!(lineButton instanceof HTMLButtonElement) || !(spinButton instanceof HTMLButtonElement) || !(fullscreenButton instanceof HTMLButtonElement)) {
              return { ok: false, reason: 'required controls missing', fetchChecks };
            }
            lineButton.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerType: 'mouse' }));
            lineButton.click();
            await new Promise((resolve) => requestAnimationFrame(resolve));
            const focusReturnedToSpin = document.activeElement === spinButton;
            fullscreenButton.focus();
            fullscreenButton.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true, cancelable: true }));
            fullscreenButton.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ', bubbles: true, cancelable: true }));
            await new Promise((resolve) => setTimeout(resolve, 80));
            const spaceStartedSpin = document.querySelector('.machine')?.classList.contains('is-spinning') === true;
            const fullscreenStayedClosed = document.fullscreenElement === null;
            const reelsPresent = document.querySelectorAll('.reel-grid').length === 1;
            const ok = fetchChecks.every(Boolean) && focusReturnedToSpin && spaceStartedSpin && fullscreenStayedClosed && reelsPresent;
            return { ok, fetchChecks, focusReturnedToSpin, spaceStartedSpin, fullscreenStayedClosed, reelsPresent };
          })()
        `);
        console.log(`THUNDER_CUT_SMOKE ${JSON.stringify(result)}`);
        app.exit(result.ok ? 0 : 1);
      } catch (error) {
        console.error('THUNDER_CUT_SMOKE_FAIL', error);
        app.exit(1);
      }
    });
  }
  mainWindow.on('closed', () => { mainWindow = null; });
  void mainWindow.loadURL(INTERNAL_ENTRY);
}

function focusMainWindow() {
  if (!mainWindow) {
    createMainWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

const singleInstanceLock = app.requestSingleInstanceLock();
if (!singleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, commandLine) => {
    launchContext = parseLaunchContext(commandLine);
    focusMainWindow();
  });

  app.on('open-url', (event, targetUrl) => {
    event.preventDefault();
    launchContext = parseLaunchContext([targetUrl]);
    focusMainWindow();
  });

  app.whenReady().then(async () => {
    await protocol.handle(INTERNAL_SCHEME, handleRendererRequest);
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
      callback(permission === 'fullscreen'
        && webContents === mainWindow?.webContents
        && isInternalNavigation(details.requestingUrl || webContents.getURL()));
    });
    ipcMain.handle('thunder-cut:get-launch-context', () => launchContext);
    const isMainRenderer = (event) => Boolean(mainWindow && !mainWindow.isDestroyed()
      && event.sender === mainWindow.webContents
      && event.senderFrame === mainWindow.webContents.mainFrame);
    registerTransactionIpc(ipcMain, createTransactionStore(stableUserData),
      event => isMainRenderer(event) && isInternalNavigation(event.senderFrame.url));
    ipcMain.handle('thunder-cut:fullscreen:get', (event) => isMainRenderer(event) ? mainWindow.isFullScreen() : false);
    ipcMain.handle('thunder-cut:fullscreen:set', (event, next) => {
      if (!isMainRenderer(event) || typeof next !== 'boolean') return false;
      return applyFullscreen(next);
    });

    if (process.platform === 'win32') {
      app.setUserTasks([
        {
          program: process.execPath,
          arguments: '',
          iconPath: process.execPath,
          iconIndex: 0,
          title: 'Play ThunderCut',
          description: 'Launch Thunder Cut - Cam the Mower Man',
        },
      ]);
    }

    createMainWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

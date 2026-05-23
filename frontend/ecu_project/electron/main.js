const { app, BrowserWindow, Menu, ipcMain, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const { spawn, execSync } = require('child_process');
const net = require('net');

const isDev = !app.isPackaged;

let mainWindow;
let pythonProcess = null;

const PYTHON_PORT = 5000;
const PYTHON_HOST = '127.0.0.1';

function isPortAvailable(port) {
  return new Promise((resolve) => {

    const server = net.createServer();

    server.once('error', (err) => {
      resolve(err.code !== 'EADDRINUSE');
    });

    server.once('listening', () => {
      server.close();
      resolve(true);
    });

    server.listen(port, PYTHON_HOST);
  });
}

function getPidUsingPort(port) {
  try {
    // Windows: use netstat to find PID
    if (process.platform === 'win32') {
      const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
      const lines = out.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      for (const line of lines) {
        const parts = line.split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && !isNaN(parseInt(pid, 10))) return parseInt(pid, 10);
      }
    }
  } catch (e) {
    // ignore
  }
  return null;
}

function killPid(pid) {
  return new Promise((resolve) => {
    if (!pid) return resolve(false);
    if (process.platform === 'win32') {
      const killer = spawn('taskkill', ['/PID', String(pid), '/F', '/T']);
      killer.on('close', (code) => resolve(code === 0));
      killer.on('error', () => resolve(false));
    } else {
      try {
        process.kill(pid, 'SIGTERM');
        resolve(true);
      } catch (e) {
        resolve(false);
      }
    }
  });
}

// NUEVO: Esperar backend antes de abrir Electron
function waitForBackend(retries = 40, delay = 500) {

  return new Promise((resolve, reject) => {

    const tryConnect = (attempt) => {

      const socket = net.createConnection(PYTHON_PORT, PYTHON_HOST);

      socket.on('connect', () => {
        socket.end();
        console.log('✅ Backend listo');
        resolve(true);
      });

      socket.on('error', () => {

        socket.destroy();

        if (attempt >= retries) {

          reject(new Error('Backend no respondió'));

        } else {

          console.log(`⏳ Esperando backend... intento ${attempt}`);

          setTimeout(() => {
            tryConnect(attempt + 1);
          }, delay);

        }

      });

    };

    tryConnect(1);

  });
}

async function startPythonServer() {

  let portAvailable = await isPortAvailable(PYTHON_PORT);

  if (!portAvailable) {
    console.warn(`⚠ Puerto ${PYTHON_PORT} ya está en uso. Intentando diagnosticar...`);

    // Intentar conectarse para saber si hay un servicio activo respondiendo
    const reachable = await new Promise((resolve) => {
      const sock = net.createConnection(PYTHON_PORT, PYTHON_HOST);
      let done = false;
      sock.setTimeout(1000);
      sock.on('connect', () => { done = true; sock.end(); resolve(true); });
      sock.on('error', () => { if (!done) resolve(false); });
      sock.on('timeout', () => { if (!done) { sock.destroy(); resolve(false); } });
    });

    if (reachable) {
      console.warn('⚠ Parece que ya hay un servidor escuchando en el puerto. No se iniciará otro.');
      return;
    }

    // Si no responde, intentar localizar PID y terminarlo (solo Windows por ahora)
    const pid = getPidUsingPort(PYTHON_PORT);
    if (pid) {
      console.log(`🔍 Encontrado PID ${pid} usando el puerto ${PYTHON_PORT}. Intentando terminarlo...`);
      const killed = await killPid(pid);
      if (killed) {
        console.log('✅ PID terminado. Reintentando disponibilidad de puerto...');
        // breve espera
        await new Promise(r => setTimeout(r, 800));
        portAvailable = await isPortAvailable(PYTHON_PORT);
      } else {
        console.warn('❌ No se pudo terminar el proceso en el puerto.');
      }
    } else {
      console.log('ℹ No se pudo identificar PID que ocupe el puerto.');
    }

    if (!portAvailable) {
      console.warn(`⚠ Puerto ${PYTHON_PORT} sigue ocupado. No se iniciará el backend.`);
      return;
    }
  }

  let backendPath;

  if (isDev) {

    backendPath = path.resolve(
      __dirname,
      '..',
      '..',
      'backend',
      'OBD2-Simulador',
      'dist',
      'ecu-backend.exe'
    );

  } else {

    const packagedCandidates = [
      path.join(process.resourcesPath, 'ecu-backend.exe'),
      path.join(process.resourcesPath, 'resources', 'ecu-backend.exe')
    ];

    backendPath = packagedCandidates.find((candidate) => require('fs').existsSync(candidate)) || packagedCandidates[0];

  }

  console.log('🚀 Intentando iniciar backend desde:', backendPath);

  const MAX_START_ATTEMPTS = 3;
  let started = false;

  for (let attempt = 1; attempt <= MAX_START_ATTEMPTS && !started; attempt++) {
    console.log(`🔁 Intento de arranque ${attempt}/${MAX_START_ATTEMPTS}`);

    try {
      pythonProcess = spawn(backendPath, [], {
        detached: false,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: false
      });

      pythonProcess.stdout.on('data', (data) => {
        console.log(`[Backend]: ${data}`);
      });

      pythonProcess.stderr.on('data', (data) => {
        console.error(`[Backend Error]: ${data}`);
      });

      pythonProcess.on('error', (err) => {
        console.error('❌ Error backend (spawn):', err);
      });

      pythonProcess.on('close', (code) => {
        console.log(`⚠ Backend cerrado con código ${code}`);
      });

      // Esperar a que el backend responda en el puerto
      try {
        await waitForBackend(12, 500); // reintenta conectar durante ~6s
        console.log(`✅ Backend listo (PID: ${pythonProcess.pid})`);
        started = true;
        break;
      } catch (e) {
        console.warn(`❌ Backend no respondió en intento ${attempt}:`, e.message || e);
        // intentar matar proceso iniciado antes de reintentar
        if (pythonProcess && pythonProcess.pid) {
          try {
            if (process.platform === 'win32') {
              spawn('taskkill', ['/PID', String(pythonProcess.pid), '/F', '/T']);
            } else {
              process.kill(pythonProcess.pid, 'SIGTERM');
            }
          } catch (killErr) {
            console.warn('⚠ No se pudo terminar proceso de backend:', killErr);
          }
          pythonProcess = null;
        }

        // Espera exponencial antes de reintentar
        await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt - 1)));
      }

    } catch (error) {
      console.error('❌ Error al iniciar backend (spawn outer):', error);
      // espera breve antes de reintentar
      await new Promise(r => setTimeout(r, 500 * attempt));
    }
  }

  if (!started) {
    console.error('❌ No se pudo iniciar el backend después de varios intentos.');
  }
}

function stopPythonServer() {

  return new Promise((resolve) => {

    if (!pythonProcess) {
      return resolve();
    }

    console.log('🛑 Deteniendo backend...');

    if (process.platform === 'win32') {

      const killer = spawn('taskkill', [
        '/PID',
        pythonProcess.pid,
        '/F',
        '/T'
      ]);

      killer.on('close', () => {

        console.log('✅ Backend terminado');

        pythonProcess = null;

        resolve();

      });

      killer.on('error', (err) => {

        console.error('❌ Error cerrando backend:', err);

        pythonProcess = null;

        resolve();

      });

    } else {

      pythonProcess.kill('SIGTERM');

      pythonProcess = null;

      resolve();

    }

  });

}

function createWindow() {

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: 'OBD-II Engine',
    show: false,

    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },

    icon: path.join(
      __dirname,
      '../src/assets/OBD-II-Icono.ico'
    ),

    autoHideMenuBar: true
  });

  mainWindow.maximize();

  if (isDev) {

    mainWindow.loadURL('http://localhost:5173');

  } else {

    mainWindow.loadFile(
      path.resolve(__dirname, '..', 'dist', 'index.html')
    );

  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
}

// MODIFICADO: configurar Feed genérico si se define UPDATE_FEED_URL
const UPDATE_FEED_URL = process.env.UPDATE_FEED_URL || null;

app.on('ready', async () => {

  await startPythonServer();

  try {

    await waitForBackend();

    createWindow();

    if (app.isPackaged) {
      if (UPDATE_FEED_URL) {
        try {
          autoUpdater.setFeedURL({ provider: 'generic', url: UPDATE_FEED_URL });
          console.log('🔁 AutoUpdater feed set to generic:', UPDATE_FEED_URL);
          autoUpdater.checkForUpdatesAndNotify();
        } catch (e) {
          console.error('❌ Error configurando feed de actualizaciones:', e);
        }
      } else {
        console.log('ℹ️ AutoUpdater deshabilitado: no se configuró UPDATE_FEED_URL');
      }
    }

  } catch (err) {

    console.error('❌ Backend no inició:', err);

    app.quit();

  }

});

app.on('window-all-closed', async () => {

  await stopPythonServer();

  if (process.platform !== 'darwin') {
    app.quit();
  }

});

app.on('activate', () => {

  if (mainWindow === null) {
    createWindow();
  }

});

app.on('before-quit', async (event) => {

  if (pythonProcess) {

    event.preventDefault();

    await stopPythonServer();

    app.quit();

  }

});

autoUpdater.on('update-available', () => {

  if (mainWindow) {
    mainWindow.webContents.send('update-available');
  }

});

autoUpdater.on('update-downloaded', () => {

  if (mainWindow) {
    mainWindow.webContents.send('update-downloaded');
  }

});

autoUpdater.on('download-progress', (progress) => {

  if (mainWindow) {
    mainWindow.webContents.send('update-progress', {
      percent: progress.percent,
      transferred: progress.transferred,
      total: progress.total,
      bytesPerSecond: progress.bytesPerSecond
    });
  }

});

autoUpdater.on('error', (error) => {

  console.error('❌ Error en actualización:', error);

  if (mainWindow) {
    mainWindow.webContents.send('update-error', error.message);
  }

});

ipcMain.on('quit-and-install', async () => {

  await stopPythonServer();

  autoUpdater.quitAndInstall();

});

ipcMain.handle('download-update', async () => {

  if (!app.isPackaged) {
    return {
      success: false,
      message: 'La descarga de actualizaciones solo está disponible en producción'
    };
  }

  try {
    await autoUpdater.downloadUpdate();

    return {
      success: true
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }

});

ipcMain.on('open-update-url', (_event, url) => {

  if (url) {
    shell.openExternal(url);
  }

});

ipcMain.handle('check-for-updates', async () => {

  if (!app.isPackaged) {

    return {
      updateAvailable: false,
      currentVersion: app.getVersion(),
      latestVersion: app.getVersion(),
      updateInfo: null
    };

  }

  try {
    if (!UPDATE_FEED_URL) {
      return {
        updateAvailable: false,
        currentVersion: app.getVersion(),
        latestVersion: app.getVersion(),
        error: 'Feed de actualizaciones no configurado (UPDATE_FEED_URL)'
      };
    }

    const result = await autoUpdater.checkForUpdates();
    const updateInfo = result?.updateInfo || null;

    return {
      updateAvailable: Boolean(updateInfo),
      currentVersion: app.getVersion(),
      latestVersion: updateInfo?.version || app.getVersion(),
      updateInfo
    };

  } catch (error) {

    return {
      updateAvailable: false,
      currentVersion: app.getVersion(),
      latestVersion: app.getVersion(),
      error: error.message
    };

  }

});

ipcMain.handle('get-python-server-status', async () => {

  return {
    running: pythonProcess !== null,
    pid: pythonProcess ? pythonProcess.pid : null,
    port: PYTHON_PORT,
    host: PYTHON_HOST
  };

});

const menu = [
  {
    label: 'Archivo',
    submenu: [
      {
        label: 'Salir',
        accelerator: 'CmdOrCtrl+Q',
        click: () => app.quit()
      }
    ]
  },
  {
    label: 'Editar',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' }
    ]
  },
  {
    label: 'Ver',
    submenu: [
      { role: 'reload' },
      { role: 'forceReload' },
      { role: 'toggleDevTools' }
    ]
  }
];

Menu.setApplicationMenu(
  Menu.buildFromTemplate(menu)
);

autoUpdater.allowDowngrade = false;
autoUpdater.allowPrerelease = true;
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;
const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const isDev = !app.isPackaged;
const { spawn } = require('child_process');
const net = require('net');

let mainWindow;
let pythonProcess = null;
const PYTHON_PORT = 5000;
const PYTHON_HOST = '127.0.0.1';

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(false);
      } else {
        resolve(true);
      }
    });
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port, '127.0.0.1');
  });
}

async function startPythonServer() {
  const portAvailable = await isPortAvailable(PYTHON_PORT);
  if (!portAvailable) {
    console.warn(`Puerto ${PYTHON_PORT} ya está en uso. Intentando usar el servidor existente...`);
    return;
  }

  let pythonScriptPath;

  if (isDev) {
    const baseDir = __dirname.split(`${path.sep}frontend`)[0];
    pythonScriptPath = path.resolve(baseDir, 'backend', 'OBD2-Simulador', 'server.py');
  } else {
    pythonScriptPath = path.join(process.resourcesPath, 'backend', 'server.py');
  }

  console.log('Iniciando servidor Python desde:', pythonScriptPath);

  try {
    const pythonExecutable = process.platform === 'win32' ? 'python' : 'python3';
    const cwd = path.dirname(pythonScriptPath);

    pythonProcess = spawn(pythonExecutable, [pythonScriptPath], {
      cwd: cwd,
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false
    });

    pythonProcess.stdout.on('data', (data) => {
      console.log(`[Python STDOUT]: ${data}`);
    });

    pythonProcess.stderr.on('data', (data) => {
      console.log(`[Python STDERR]: ${data}`);
    });

    pythonProcess.on('error', (error) => {
      console.error('Error iniciando proceso Python:', error);
    });

    pythonProcess.on('close', (code, signal) => {
      console.log(`Proceso Python terminado con código: ${code}, señal: ${signal}`);
      pythonProcess = null;
    });

    console.log('Servidor Python iniciado (PID:', pythonProcess.pid, ')');
  } catch (error) {
    console.error('Error al iniciar servidor Python:', error);
  }
}

function stopPythonServer() {
  return new Promise((resolve) => {
    if (!pythonProcess) {
      console.log('No hay proceso Python activo');
      resolve();
      return;
    }

    console.log('Deteniendo servidor Python (PID:', pythonProcess.pid, ')...');

    const killTimeout = setTimeout(() => {
      console.warn('Forzando cierre del proceso Python...');
      try {
        if (process.platform === 'win32') {
          spawn('taskkill', ['/PID', pythonProcess.pid, '/F', '/T']);
        } else {
          pythonProcess.kill('SIGKILL');
        }
      } catch (error) {
        console.error('Error al forzar cierre:', error);
      }
      pythonProcess = null;
      resolve();
    }, 5000);

    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/PID', pythonProcess.pid, '/T']);
      } else {
        pythonProcess.kill('SIGTERM');
      }
    } catch (e) {
      console.error('Error en cierre graceful:', e);
    }

    pythonProcess.on('exit', () => {
      clearTimeout(killTimeout);
      pythonProcess = null;
      console.log('Servidor Python detenido correctamente');
      resolve();
    });
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
    icon: path.join(__dirname, '../src/assets/OBD-II-Icono.ico'),
    autoHideMenuBar: true
  });

  if (app.isPackaged) {
    const rutaProduccion = path.resolve(__dirname, '..', 'dist', 'index.html');
    mainWindow.loadFile(rutaProduccion);
  } else {
    mainWindow.loadURL('http://localhost:5173');
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', async () => {
  await startPythonServer();
  createWindow();

  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify();
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
  if (mainWindow) mainWindow.webContents.send('update-available');
});

autoUpdater.on('update-downloaded', () => {
  if (mainWindow) mainWindow.webContents.send('update-downloaded');
});

autoUpdater.on('error', (error) => {
  console.error('Error en actualización:', error);
  if (mainWindow) mainWindow.webContents.send('update-error', error.message);
});

ipcMain.on('quit-and-install', async () => {
  await stopPythonServer();
  autoUpdater.quitAndInstall();
});

ipcMain.handle('check-for-updates', async () => {
  if (!app.isPackaged) {
    return { updateAvailable: false, version: app.getVersion() };
  }
  try {
    const result = await autoUpdater.checkForUpdates();
    return {
      updateAvailable: result.updateInfo !== null,
      version: app.getVersion()
    };
  } catch (error) {
    return { updateAvailable: false, error: error.message };
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
    submenu: [{ label: 'Salir', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() }]
  },
  {
    label: 'Editar',
    submenu: [
      { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
      { role: 'cut' }, { role: 'copy' }, { role: 'paste' }
    ]
  },
  {
    label: 'Ver',
    submenu: [{ role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' }]
  }
];

Menu.setApplicationMenu(Menu.buildFromTemplate(menu));

autoUpdater.allowDowngrade = false;
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;
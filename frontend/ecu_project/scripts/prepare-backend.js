const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// El archivo principal del backend es server.py (no main.py)
const backendSrc = path.join(__dirname, '../../../backend/OBD2-Simulador/server.py');
const distExe = path.join(__dirname, '../../../backend/OBD2-Simulador/dist/ecu-backend.exe');
const resourcesDir = path.join(__dirname, '../resources');
const dest = path.join(resourcesDir, 'ecu-backend.exe');

console.log('🚀 Preparando backend...');
console.log('ℹ __dirname:', __dirname);

// Mostrar rutas para diagnóstico
console.log('ℹ backendSrc:', backendSrc);
console.log('ℹ distExe:', distExe);
console.log('ℹ resourcesDir:', resourcesDir);

function getAddDataArgs() {
  const dataDir = path.join(__dirname, '../../../backend/OBD2-Simulador/data');

  if (!fs.existsSync(dataDir)) {
    console.warn('⚠ No se encontró la carpeta data del backend:', dataDir);
    return [];
  }

  return fs.readdirSync(dataDir)
    .filter((file) => file.toLowerCase().endsWith('.json'))
    .map((file) => {
      const source = path.join(dataDir, file);
      return `--add-data "${source};data"`;
    });
}

const addDataArgs = getAddDataArgs();

// 1. Generar siempre el ejecutable para evitar reutilizar un binario sin datos.
try {
  console.log('📦 Ejecutando PyInstaller...');
  const addDataCli = addDataArgs.length > 0 ? ` ${addDataArgs.join(' ')}` : '';
  execSync(`pyinstaller --onefile --name ecu-backend${addDataCli} "${backendSrc}"`, {
    cwd: path.join(__dirname, '../../../backend/OBD2-Simulador'),
    stdio: 'inherit'
  });
} catch (e) {
  console.error('❌ Error al generar el ejecutable (PyInstaller falló):', e.message || e);
  console.warn('⚠ Si ya generaste el exe manualmente, coloca backend/dist/ecu-backend.exe para que el build lo copie.');
  process.exit(1);
}

// 2. Copiar a la carpeta de Electron
if (!fs.existsSync(resourcesDir)) fs.mkdirSync(resourcesDir, { recursive: true });
try {
  fs.copyFileSync(distExe, dest);
  console.log('✅ Backend listo en resources/');
} catch (e) {
  console.error('❌ No se pudo copiar el ejecutable del backend:', e.message || e);
  process.exit(1);
}

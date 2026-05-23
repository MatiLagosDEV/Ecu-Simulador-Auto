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

// 1. Si el ejecutable ya existe en backend/dist, evitamos volver a generarlo.
if (fs.existsSync(distExe)) {
  console.log('ℹ Ejecutable ya existe en backend/dist, se omite PyInstaller.');
} else {
  // Intentar generar ejecutable con PyInstaller
  try {
    console.log('📦 Ejecutando PyInstaller...');
    execSync(`pyinstaller --onefile --name ecu-backend "${backendSrc}"`, {
      cwd: path.join(__dirname, '../../../backend/OBD2-Simulador'),
      stdio: 'inherit'
    });
  } catch (e) {
    console.error('❌ Error al generar el ejecutable (PyInstaller falló):', e.message || e);
    console.warn('⚠ Si ya generaste el exe manualmente, coloca backend/dist/ecu-backend.exe para que el build lo copie.');
    process.exit(1);
  }
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

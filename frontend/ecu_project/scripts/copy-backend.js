const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const backendExeSrc = path.resolve(projectRoot, '..', '..', 'backend', 'OBD2-Simulador', 'dist', 'ecu-backend.exe');
const resourcesDir = path.resolve(projectRoot, 'resources');
const backendExeDest = path.join(resourcesDir, 'ecu-backend.exe');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function copyFile(src, dest) {
  if (!fs.existsSync(src)) {
    console.error(`Source backend exe not found: ${src}`);
    process.exit(1);
  }

  ensureDir(path.dirname(dest));

  fs.copyFileSync(src, dest);
  console.log(`Copied backend exe to ${dest}`);
}

copyFile(backendExeSrc, backendExeDest);

# Configuración de Actualizaciones - Guía de Implementación

## 📋 Estado Actual

✅ **Completado:**
- `updateService.js` configurado con URL de GitHub correcta
- `version.json` creado en la raíz del repositorio
- Modal de configuración funcional
- Sistema de detección de actualizaciones integrado

---

## 🚀 Pasos para Activar Actualizaciones

### 1️⃣ Subir `version.json` a GitHub

El archivo `version.json` debe estar en la **raíz del repositorio** en GitHub.

**Ubicación esperada:**
```
https://raw.githubusercontent.com/MatiLagosDEV/Ecu-Simulador-Auto/main/version.json
```

**Archivo local:**
```
D:\...\Ecu Simulador\version.json
```

**¿Qué hacer?**
1. Sube este archivo a GitHub en la raíz del repositorio
2. Asegúrate de que esté en la rama `main`
3. El archivo será accesible públicamente en la URL anterior

---

### 2️⃣ Crear Releases en GitHub

Cuando hagas una nueva versión:

1. Actualiza la versión en `version.json`:
   ```json
   {
     "version": "1.1.0",
     "downloadUrl": "https://github.com/MatiLagosDEV/Ecu-Simulador-Auto/releases/download/v1.1.0/ECU-Simulador-1.1.0.exe",
     ...
   }
   ```

2. Crea un Release en GitHub:
   - Ve a: `https://github.com/MatiLagosDEV/Ecu-Simulador-Auto/releases`
   - Click en "Create a new release"
   - Sube el archivo `.exe`
   - Publica el release

3. Sube el `version.json` actualizado

---

### 3️⃣ Cómo Funciona el Sistema

**En la App:**
1. Usuario abre el modal de Configuración (wrench icon)
2. Click en "Verificar Actualizaciones"
3. La app descarga `version.json` desde GitHub
4. Compara versiones locales vs remotas
5. Si hay actualización → Muestra disponible
6. Usuario descarga el `.exe` desde el enlace

---

### 4️⃣ Variables de Configuración

**En `updateService.js`:**
```javascript
const VERSION_URL = "https://raw.githubusercontent.com/MatiLagosDEV/Ecu-Simulador-Auto/main/version.json";
```

✅ **Ya está configurado correctamente**

---

### 5️⃣ Estructura de `version.json`

```json
{
  "version": "1.0.0",                    // Versión actual disponible
  "latestVersion": "1.0.0",              // Alias de version
  "releaseDate": "2026-05-20",           // Fecha del release
  "downloadUrl": "...",                  // URL de descarga del .exe
  "changelog": ["Feature 1", "Fix 1"],   // Lista de cambios
  "minimumVersion": "1.0.0",             // Versión mínima soportada
  "critical": false,                     // ¿Es actualización crítica?
  "releaseNotes": "..."                  // Notas de release
}
```

---

## 🔧 Próximos Pasos (Opcional - Para Electron)

### Integrar `electron-updater` para .exe

Cuando empaques la app con Electron:

1. Instala `electron-updater`:
   ```bash
   npm install electron-updater
   ```

2. En tu `main.js` de Electron:
   ```javascript
   const { app, BrowserWindow } = require('electron');
   const { autoUpdater } = require('electron-updater');

   app.whenReady().then(() => {
     autoUpdater.checkForUpdatesAndNotify();
   });
   ```

3. Electron descargará automáticamente desde `downloadUrl`

---

## 📱 Verificación

Para probar que todo funciona:

1. Abre el navegador
2. Ve a: `https://raw.githubusercontent.com/MatiLagosDEV/Ecu-Simulador-Auto/main/version.json`
3. Deberías ver el contenido del archivo en JSON

✅ Si lo ves → Todo está listo
❌ Si da error 404 → El archivo no está en GitHub aún

---

## 💾 Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `updateService.js` | URL de GitHub configurada ✅ |
| `version.json` | Actualizado con datos v1.0.0 ✅ |

---

**¿Lista la app para actualizaciones? ✨**

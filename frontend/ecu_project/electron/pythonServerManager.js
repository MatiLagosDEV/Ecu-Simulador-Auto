const { spawn } = require('child_process');
const net = require('net');
const path = require('path');
const { app, ipcMain } = require('electron');

/**
 * PythonServerManager - Gestor centralizado del servidor Flask
 * Maneja inicio, detención y monitoreo del proceso Python
 */
class PythonServerManager {
  constructor(port = 5000, host = '127.0.0.1') {
    this.port = port;
    this.host = host;
    this.process = null;
    this.isHealthy = false;
  }

  /**
   * Verifica si el puerto está en uso
   */
  async isPortInUse() {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', (err) => {
        resolve(err.code === 'EADDRINUSE');
      });
      server.once('listening', () => {
        server.close();
        resolve(false);
      });
      server.listen(this.port, this.host);
    });
  }

  /**
   * Obtiene la ruta del script Python según el entorno
   */
  getScriptPath(isDev) {
    let pythonScriptPath;

    if (isDev) {
      // CORREGIDO: Subimos dos niveles de forma segura para salir de frontend/ecu_project hacia la raíz
      pythonScriptPath = path.resolve(__dirname, '..', '..', 'backend', 'server.py');
    } else {
      // En producción: los archivos están en resources/
      pythonScriptPath = path.join(
        process.resourcesPath || app.getAppPath(),
        'backend',
        'server.py'
      );
    }

    return pythonScriptPath;
  }

  /**
   * Inicia el servidor Python
   * @param {string} scriptPath - Ruta al script Python
   * @param {number} retries - Intentos de inicio
   */
  async start(scriptPath, retries = 3) {
    return new Promise(async (resolve) => {
      const inUse = await this.isPortInUse();

      if (inUse) {
        console.log(`⚠️ Puerto ${this.port} ya está en uso`);
        console.log('Verificando servidor existente...');
        
        try {
          // Intentar conectar al servidor existente
          const axios = require('axios');
          const response = await axios.get(
            `http://${this.host}:${this.port}/api/estado`,
            { timeout: 2000 }
          );

          if (response.status === 200) {
            console.log('✅ Servidor Python ya está ejecutándose');
            this.isHealthy = true;
            this.process = { pid: 'existing', managed: false };
            resolve(true);
            return;
          }
        } catch (error) {
          console.log('Servidor existente no responde, intentando liberar puerto...');
        }
      }

      // Intentar iniciar el servidor
      for (let attempt = 1; attempt <= retries; attempt++) {
        console.log(`🚀 Iniciando servidor Python (intento ${attempt}/${retries})...`);
        console.log(`   Ruta: ${scriptPath}`);

        try {
          this.process = spawn('python', [scriptPath], {
            detached: false,
            stdio: ['ignore', 'pipe', 'pipe'],
            shell: true,
            cwd: path.dirname(scriptPath)
          });

          // Listeners para logs
          this.process.stdout.on('data', (data) => {
            const output = data.toString().trim();
            console.log(`[Python] ${output}`);
            
            // Detectar cuando Flask está listo
            if (output.includes('Running on') || output.includes('WARNING')) {
              this.isHealthy = true;
            }
          });

          this.process.stderr.on('data', (data) => {
            console.error(`[Python Error] ${data.toString().trim()}`);
          });

          this.process.on('error', (error) => {
            console.error('❌ Error iniciando proceso:', error.message);
            if (attempt < retries) {
              console.log(`⏳ Reintentando en 2 segundos...`);
              setTimeout(() => {}, 2000);
            }
          });

          this.process.on('close', (code, signal) => {
            console.warn(`⚠️ Proceso Python terminado (código: ${code}, señal: ${signal})`);
            this.isHealthy = false;
            this.process = null;
          });

          console.log(`✅ Servidor Python iniciado (PID: ${this.process.pid})`);

          // Esperar a que el servidor esté listo
          await this.waitForServer(3000);
          resolve(this.isHealthy);
          return;
        } catch (error) {
          console.error(`❌ Error en intento ${attempt}:`, error.message);
          if (attempt < retries) {
            await new Promise(r => setTimeout(r, 1000));
          }
        }
      }

      console.error('❌ No se pudo iniciar el servidor Python');
      resolve(false);
    });
  }

  /**
   * Espera a que el servidor esté listo
   */
  async waitForServer(timeout = 5000) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (this.isHealthy) {
        return true;
      }
      await new Promise(r => setTimeout(r, 100));
    }

    return this.isHealthy;
  }

  /**
   * Detiene el servidor Python de forma segura
   */
  async stop() {
    return new Promise((resolve) => {
      if (!this.process || this.process.managed === false) {
        console.log('✅ No hay proceso Python administrado');
        resolve();
        return;
      }

      console.log(`🛑 Deteniendo servidor Python (PID: ${this.process.pid})...`);

      const killTimeout = setTimeout(() => {
        console.warn('⚠️ Forzando cierre del proceso Python...');
        try {
          if (process.platform === 'win32') {
            spawn('taskkill', ['/PID', this.process.pid, '/F']);
          } else {
            this.process.kill('SIGKILL');
          }
        } catch (error) {
          console.error('Error al forzar cierre:', error.message);
        }
        this.process = null;
        resolve();
      }, 5000);

      // Primero intentar SIGTERM (cierre graceful)
      try {
        this.process.kill('SIGTERM');
      } catch (error) {
        console.error('Error enviando SIGTERM:', error.message);
      }

      this.process.on('exit', () => {
        clearTimeout(killTimeout);
        console.log('✅ Servidor Python detenido correctamente');
        this.process = null;
        this.isHealthy = false;
        resolve();
      });
    });
  }

  /**
   * Obtiene el estado actual del servidor
   */
  getStatus() {
    return {
      running: this.process !== null,
      healthy: this.isHealthy,
      pid: this.process ? this.process.pid : null,
      port: this.port,
      host: this.host
    };
  }
}

// Exportar singleton
module.exports = PythonServerManager;

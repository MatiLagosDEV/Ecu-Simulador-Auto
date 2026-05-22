import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Rutas relativas para producción en Electron
  build: {
    outDir: 'dist', // Vite guarda aquí, Electron busca aquí
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          // Cuando el backend está apagado, devolver 200 + JSON de error
          // en lugar de 500, para que el navegador no lo loguee como error.
          proxy.on('error', (_err, _req, res) => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'servidor_offline' }));
          });
        },
      },
    },
  },
})

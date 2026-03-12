import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
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

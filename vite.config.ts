import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/** When Vite base is `/student/`, refreshing `/student` shows a base-path error. */
function studentBaseRedirect(base: string): Plugin {
  return {
    name: 'student-base-redirect',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (base !== '/student/' && base !== '/student') {
          next();
          return;
        }
        const raw = req.url ?? '';
        const path = raw.split('?')[0];
        if (path === '/student') {
          const qs = raw.includes('?') ? raw.slice(raw.indexOf('?')) : '';
          res.writeHead(301, { Location: `/student/${qs}` });
          res.end();
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  /** Local default `/student/`; CloudFront student host uses `VITE_BASE=/`. */
  const base = env.VITE_BASE || process.env.VITE_BASE || '/student/';

  return {
    base,
    plugins: [studentBaseRedirect(base), react(), tailwindcss()],
    server: {
      port: 5174,
      proxy: {
        '/api': 'http://127.0.0.1:8000',
        '/sanctum': 'http://127.0.0.1:8000',
        '/storage': 'http://127.0.0.1:8000',
      },
    },
  };
});

import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/** Local/Apache base is `/student/`; CloudFront on student.cycbankease.com uses `/`. */
const base = process.env.VITE_BASE || '/student/';

/** When Vite base is `/student/`, refreshing `/student` shows a base-path error. */
function studentBaseRedirect(): Plugin {
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

export default defineConfig({
  base,
  plugins: [studentBaseRedirect(), react(), tailwindcss()],
  server: {
    port: 5174,
    proxy: {
      '/api': 'http://127.0.0.1:8000',
      '/sanctum': 'http://127.0.0.1:8000',
      '/storage': 'http://127.0.0.1:8000',
    },
  },
});

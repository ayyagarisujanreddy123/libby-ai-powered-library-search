import path from 'path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Dev-only plugin: mount api/chat.ts as middleware so `npm run dev` exposes /api/chat
// In production, Vercel serves the same file as a serverless function.
function apiDevPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'libby-api-dev',
    configureServer(server) {
      // Mirror env vars into process.env for the serverless handler during dev
      for (const [k, v] of Object.entries(env)) {
        if (process.env[k] === undefined) process.env[k] = v;
      }
      server.middlewares.use('/api/chat', async (req, res) => {
        try {
          const mod = await server.ssrLoadModule('/api/chat.ts');
          await mod.default(req, res);
        } catch (err: any) {
          console.error('Dev /api/chat error:', err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err?.message || 'Dev handler error' }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      strictPort: false,
      cors: true,
    },
    plugins: [react(), apiDevPlugin(env)],
    define: {
      global: 'globalThis',
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './'),
      },
    },
    optimizeDeps: {
      esbuildOptions: {
        define: {
          global: 'globalThis',
        },
      },
    },
    build: {
      commonjsOptions: {
        include: [/node_modules/],
        transformMixedEsModules: true,
      },
      target: 'es2015',
    },
    esbuild: {
      target: 'es2015',
    },
  };
});

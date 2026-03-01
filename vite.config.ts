import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      strictPort: false,
      cors: true,
      proxy: {
        // Proxy Pinecone API requests to bypass CORS
        '/api/pinecone': {
          target: env.VITE_PINECONE_HOST || 'https://libby-chat-bot-ikxfznp.svc.aped-4627-b74a.pinecone.io',
          changeOrigin: true,
          rewrite: (path: string) => path.replace(/^\/api\/pinecone/, ''),
          headers: {
            'Api-Key': env.VITE_PINECONE_API_KEY || '',
          },
        },
      },
    },
    plugins: [react()],
    define: {
      // Polyfill for Node.js global variable in browser
      global: 'globalThis',
      // OpenAI API key is accessed via import.meta.env.VITE_OPENAI_API_KEY
      // No need for process.env definitions as Vite handles VITE_ prefixed vars automatically
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './'),
      }
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
      target: 'es2015', // Better Safari compatibility
    },
    // Additional Safari compatibility
    esbuild: {
      target: 'es2015',
    }
  };
});

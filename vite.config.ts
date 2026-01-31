import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0', // Allow network access
        strictPort: false, // Allow port fallback if 3000 is taken
        hmr: {
          clientPort: 3000, // HMR port for network connections
        },
        cors: true, // Enable CORS for network access
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
        include: ['@pinecone-database/pinecone'],
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

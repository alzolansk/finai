import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: true, // Aceita qualquer host
        strictPort: true,
        allowedHosts: [
          'madalynn-distraite-noncuratively.ngrok-free.dev',
          '.ngrok-free.dev',
          '.ngrok.io',
          'localhost'
        ],
        hmr: {
          clientPort: 443, // Porta HTTPS do ngrok
        },
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});

import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // Load env from project root (two levels up)
    const env = loadEnv(mode, path.resolve(__dirname, '../../'), '');
    const resolvedApiKey =
      env.CLIENT_GEMINI_API_KEY ||
      env.GEMINI_API_KEY ||
      env.VITE_API_KEY ||
      process.env.CLIENT_GEMINI_API_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.VITE_API_KEY ||
      '';
    return {
      server: {
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        // Support both CLIENT_GEMINI_API_KEY (from remote) and GEMINI_API_KEY/VITE_API_KEY (from local)
        'process.env.API_KEY': JSON.stringify(resolvedApiKey),
        'process.env.GEMINI_API_KEY': JSON.stringify(resolvedApiKey),
        'import.meta.env.VITE_API_KEY': JSON.stringify(resolvedApiKey),
        'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(resolvedApiKey)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});

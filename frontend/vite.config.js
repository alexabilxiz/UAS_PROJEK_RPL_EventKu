import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(async ({ command, mode, isPreview }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const demo = command === 'serve' && mode === 'demo' && !isPreview;
  const demoPlugin = demo ? (await import('./demo/eventkuDemo.js')).eventkuDemo() : null;
  return {
    plugins: [react(), tailwindcss(), demoPlugin],
    server: {
      proxy: demo ? undefined : {
        '/api': {
          target: env.API_PROXY_TARGET || 'http://127.0.0.1:3000',
          changeOrigin: true,
        },
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.js'],
      include: ['src/**/*.test.{js,jsx}'],
      restoreMocks: true,
      clearMocks: true,
    },
  };
});

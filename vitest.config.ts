import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['app/renderer/**/*.ts'],
      exclude: [
        'app/renderer/main.ts', // Exclude until fully refactored
        'app/renderer/**/*.d.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './app/renderer'),
      '@/game': path.resolve(__dirname, './app/renderer/game'),
      '@/ui': path.resolve(__dirname, './app/renderer/ui'),
      '@/data': path.resolve(__dirname, './app/renderer/data'),
      '@/content': path.resolve(__dirname, './app/renderer/content'),
      '@/net': path.resolve(__dirname, './app/renderer/net'),
      '@/utils': path.resolve(__dirname, './app/renderer/utils'),
    },
  },
});

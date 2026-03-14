import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'app/renderer',
  base: './',
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
    copyPublicDir: true,
    assetsDir: 'assets',
          rollupOptions: {
        input: {
          main: resolve(__dirname, 'app/renderer/index.html'),
          game: resolve(__dirname, 'app/renderer/game.html'),
          'lan-game': resolve(__dirname, 'app/renderer/lan-game.html')
        },
      output: {
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js'
      }
    }
  },
  publicDir: 'content',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'app/renderer'),
      '@/game': resolve(__dirname, 'app/renderer/game'),
      '@/ui': resolve(__dirname, 'app/renderer/ui'),
      '@/data': resolve(__dirname, 'app/renderer/data'),
      '@/content': resolve(__dirname, 'app/renderer/content'),
      '@/net': resolve(__dirname, 'app/renderer/net'),
      '@/utils': resolve(__dirname, 'app/renderer/utils'),
      '@/main': resolve(__dirname, 'app/main'),
      '@/preload': resolve(__dirname, 'app/preload'),
      '@/config': resolve(__dirname, 'config'),
      '@/tests': resolve(__dirname, 'tests')
    }
  },
  server: {
    port: 5179,
    strictPort: true
  },
  define: {
    __DEV__: JSON.stringify(process.env.NODE_ENV === 'development')
  }
});



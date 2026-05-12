import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'shared'),
    },
  },
  build: {
    outDir: 'dist/electron',
    emptyOutDir: true,
    lib: {
      entry: {
        main: path.resolve(__dirname, 'electron/main.ts'),
        preload: path.resolve(__dirname, 'electron/preload.ts'),
      },
      formats: ['cjs'],
    },
    rollupOptions: {
      external: [
        'electron',
        'better-sqlite3',
        'electron-store',
        'electron-updater',
        'uuid',
        'module',
        'path',
        'fs',
        'os',
        'crypto',
        'child_process',
        'url',
        'events',
        'stream',
        'util',
        'buffer',
        // node: 前缀版本（MCP SDK 使用）
        'node:stream',
        'node:process',
        'node:child_process',
        'node:events',
        'node:fs',
        'node:path',
        'node:os',
        'node:crypto',
        'node:url',
        'node:util',
        'node:buffer',
      ],
      output: {
        entryFileNames: '[name].cjs',
      },
    },
    sourcemap: true,
  },
});

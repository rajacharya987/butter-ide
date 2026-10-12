import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import * as path from 'node:path';

export default defineConfig({
  root: path.resolve(__dirname, 'src/renderer'),
  base: './',
  plugins: [react()],
  build: {
    outDir: path.resolve(__dirname, 'dist/renderer'),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@ai-ide/shared': path.resolve(__dirname, '../../packages/shared/src'),
      '@ai-ide/shell-adapters': path.resolve(__dirname, '../../packages/shell-adapters/src'),
      '@ai-ide/ai-providers': path.resolve(__dirname, '../../packages/ai-providers/src'),
      '@ai-ide/security': path.resolve(__dirname, '../../packages/security/src'),
      '@ai-ide/workspace': path.resolve(__dirname, '../../packages/workspace/src'),
      '@ai-ide/git-integration': path.resolve(__dirname, '../../packages/git-integration/src'),
      '@ai-ide/toolchain-manager': path.resolve(__dirname, '../../packages/toolchain-manager/src'),
      '@ai-ide/agent-core': path.resolve(__dirname, '../../packages/agent-core/src'),
    },
  },
});

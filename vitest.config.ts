import { defineConfig } from 'vitest/config';
import * as path from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000,
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@ai-ide/shared': path.resolve(__dirname, 'packages/shared/src'),
      '@ai-ide/shell-adapters': path.resolve(__dirname, 'packages/shell-adapters/src'),
      '@ai-ide/ai-providers': path.resolve(__dirname, 'packages/ai-providers/src'),
      '@ai-ide/security': path.resolve(__dirname, 'packages/security/src'),
      '@ai-ide/workspace': path.resolve(__dirname, 'packages/workspace/src'),
      '@ai-ide/git-integration': path.resolve(__dirname, 'packages/git-integration/src'),
      '@ai-ide/toolchain-manager': path.resolve(__dirname, 'packages/toolchain-manager/src'),
      '@ai-ide/agent-core': path.resolve(__dirname, 'packages/agent-core/src'),
    },
  },
});

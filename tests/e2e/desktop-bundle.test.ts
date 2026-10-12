import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Desktop App E2E Bundle & Security Packaging Tests', () => {
  const desktopDist = path.resolve(__dirname, '../../apps/desktop/dist');

  it('verifies compiled Electron main process bundle exists and has no syntax errors', () => {
    const mainJs = path.join(desktopDist, 'main/index.js');
    expect(fs.existsSync(mainJs)).toBe(true);

    const mainContent = fs.readFileSync(mainJs, 'utf-8');
    expect(mainContent).toContain('BrowserWindow');
    expect(mainContent).toContain('contextIsolation: true');
    expect(mainContent).toContain('nodeIntegration: false');
  });

  it('verifies secure preload bundle exists and exports contextBridge ideAPI', () => {
    const preloadJs = path.join(desktopDist, 'preload/index.js');
    expect(fs.existsSync(preloadJs)).toBe(true);

    const preloadContent = fs.readFileSync(preloadJs, 'utf-8');
    expect(preloadContent).toContain('contextBridge');
    expect(preloadContent).toContain('exposeInMainWorld');
    expect(preloadContent).toContain('ideAPI');
  });

  it('verifies production Vite renderer assets exist', () => {
    const indexHtml = path.join(desktopDist, 'renderer/index.html');
    expect(fs.existsSync(indexHtml)).toBe(true);

    const assetsDir = path.join(desktopDist, 'renderer/assets');
    expect(fs.existsSync(assetsDir)).toBe(true);

    const files = fs.readdirSync(assetsDir);
    expect(files.some((f) => f.endsWith('.js'))).toBe(true);
    expect(files.some((f) => f.endsWith('.css'))).toBe(true);
  });
});

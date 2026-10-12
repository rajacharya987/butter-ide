import { describe, it, expect } from 'vitest';
import { ToolchainManager } from '@ai-ide/toolchain-manager';

describe('Toolchain Manager Unit Tests', () => {
  it('initializes catalog with over 15 programming languages and build tools', async () => {
    const tm = new ToolchainManager();
    const catalog = await tm.getCatalog();

    expect(catalog.length).toBeGreaterThanOrEqual(18);

    const ids = catalog.map((c) => c.id);
    expect(ids).toContain('c');
    expect(ids).toContain('cpp');
    expect(ids).toContain('rust');
    expect(ids).toContain('go');
    expect(ids).toContain('python');
    expect(ids).toContain('nodejs');
    expect(ids).toContain('typescript');
    expect(ids).toContain('cmake');
    expect(ids).toContain('ninja');
    expect(ids).toContain('make');
    expect(ids).toContain('git');
  });

  it('generates declarative install commands matching the operating system', () => {
    const tm = new ToolchainManager();
    const cmakeCmd = tm.getInstallCommand('cmake');
    expect(cmakeCmd).toBeDefined();
    // On Arch Linux, it should use pacman
    expect(cmakeCmd).toContain('pacman -S');
  });

  it('verifies installed tools and captures their real version', async () => {
    const tm = new ToolchainManager();
    // gcc is known to be installed on this Arch environment
    const gccResult = await tm.verifyItem('c');
    expect(gccResult.isInstalled).toBe(true);
    expect(gccResult.version).toBeDefined();
  });
});

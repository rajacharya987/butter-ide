import { describe, it, expect } from 'vitest';
import {
  OSDetector,
  ShellRegistry,
  RazzShellAdapter,
  PowerShellAdapter,
  BashAdapter,
} from '@ai-ide/shell-adapters';

describe('Shell Adapters & OS Detection Unit Tests', () => {
  it('detects operating system details correctly', () => {
    const osInfo = OSDetector.getOSInfo();
    expect(osInfo).toBeDefined();
    expect(['arch', 'ubuntu', 'debian', 'fedora', 'linux', 'windows', 'macos']).toContain(osInfo.osType);
    expect(osInfo.arch).toBe('x64');
    expect(osInfo.platform).toBe(process.platform);

    if (osInfo.isArch) {
      expect(osInfo.defaultRecommendedShell).toBe('razzshell');
    }
  });

  it('exposes complete RazzShell capability registry matching repository built-ins', () => {
    const adapter = new RazzShellAdapter();
    const capabilities = adapter.getCapabilities();

    expect(capabilities.length).toBeGreaterThanOrEqual(15);

    // Verify key RazzShell built-ins
    const names = capabilities.map((c) => c.command);
    expect(names).toContain('change');
    expect(names).toContain('list');
    expect(names).toContain('create');
    expect(names).toContain('delete');
    expect(names).toContain('say');
    expect(names).toContain('where');
    expect(names).toContain('undo');
    expect(names).toContain('why');
    expect(names).toContain('fix');
    expect(names).toContain('howto');

    // Verify POSIX equivalents mapping
    const changeCap = capabilities.find((c) => c.command === 'change');
    expect(changeCap?.posixEquivalent).toBe('cd');

    const listCap = capabilities.find((c) => c.command === 'list');
    expect(listCap?.posixEquivalent).toBe('ls');
  });

  it('formats PowerShell command lines safely', () => {
    const ps = new PowerShellAdapter();
    const formatted = ps.formatCommandLine('Get-Process');
    expect(formatted.args).toContain('-ExecutionPolicy');
    expect(formatted.args).toContain('Bypass');
    expect(formatted.args).toContain('Get-Process');
  });

  it('returns valid installation guides for different distributions', () => {
    const razz = new RazzShellAdapter();
    const archGuide = razz.getInstallationGuide({
      osType: 'arch',
      platform: 'linux',
      distName: 'Arch Linux',
      arch: 'x64',
      release: '6.x',
      isArch: true,
      isUbuntuOrDebian: false,
      isWindows: false,
      isMacOS: false,
      defaultRecommendedShell: 'razzshell',
    });

    expect(archGuide).toContain('yay -S razzshell');
    expect(archGuide).toContain('pacman');

    const ubuntuGuide = razz.getInstallationGuide({
      osType: 'ubuntu',
      platform: 'linux',
      distName: 'Ubuntu',
      arch: 'x64',
      release: '24.04',
      isArch: false,
      isUbuntuOrDebian: true,
      isWindows: false,
      isMacOS: false,
      defaultRecommendedShell: 'razzshell',
    });

    expect(ubuntuGuide).toContain('apt-get');
  });

  it('ShellRegistry lists available profiles and picks proper recommendation', async () => {
    const registry = new ShellRegistry();
    const profiles = await registry.getAvailableProfiles();

    expect(profiles.length).toBeGreaterThanOrEqual(2);
    const defaultProfile = profiles.find((p) => p.isDefault);
    expect(defaultProfile).toBeDefined();

    const bashProfile = profiles.find((p) => p.shellType === 'bash');
    expect(bashProfile?.isAvailable).toBe(true);
  });
});

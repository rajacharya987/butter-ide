import { describe, it, expect } from 'vitest';
import { RazzShellAdapter } from '@ai-ide/shell-adapters';

describe('RazzShell Integration Tests', () => {
  it('executes native built-in commands through RazzShellAdapter', async () => {
    const adapter = new RazzShellAdapter();
    const isAvail = await adapter.isAvailable();
    expect(isAvail).toBe(true);

    const version = await adapter.getVersion();
    expect(version).toBe('2.0.0');

    // Test built-in `say` command
    const res = await adapter.executeCommand('say "Testing RazzShell Integration"', process.cwd());
    expect(res.exitCode).toBe(0);
    expect(res.stdout).toContain('Testing RazzShell Integration');
    expect(res.shellType).toBe('razzshell');
    expect(res.durationMs).toBeGreaterThan(0);
  });

  it('correctly reports non-zero exit codes or failures in RazzShell', async () => {
    const adapter = new RazzShellAdapter();
    // Non-existent command
    const res = await adapter.executeCommand('nonexistent_command_12345', process.cwd());
    expect(res.exitCode).not.toBe(0);
  });
});

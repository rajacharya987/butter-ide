import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import {
  PathValidator,
  SecretRedactor,
  PermissionBroker,
} from '@ai-ide/security';

describe('Security & Privacy Unit Tests', () => {
  const workspaceRoot = '/home/dedsec/butter';

  it('validates paths inside workspace and rejects traversal attacks', () => {
    // Valid sub-paths
    expect(PathValidator.isPathInsideWorkspace('/home/dedsec/butter/src/main.cpp', workspaceRoot)).toBe(true);
    expect(PathValidator.isPathInsideWorkspace('/home/dedsec/butter/package.json', workspaceRoot)).toBe(true);

    // Path traversal violations
    expect(PathValidator.isPathInsideWorkspace('/home/dedsec/butter/../../etc/passwd', workspaceRoot)).toBe(false);
    expect(PathValidator.isPathInsideWorkspace('/etc/shadow', workspaceRoot)).toBe(false);
    expect(PathValidator.isPathInsideWorkspace('/home/dedsec/.ssh/id_rsa', workspaceRoot)).toBe(false);

    expect(() => {
      PathValidator.assertSafeWorkspacePath('../secret.txt', workspaceRoot);
    }).toThrow(/Security Violation/);
  });

  it('redacts sensitive API keys and secrets in text', () => {
    const rawLogs = `
      Connected with API Key: sk-proj-1234567890abcdef1234567890!
      Claude key: sk-ant-api03-abcdefghijklmnopqrstuvwxyz123456!
      Gemini: AIzaSyD987654321abcdefghijklmnopqrstuv!
      Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.secret!
    `;

    const redacted = SecretRedactor.redact(rawLogs);

    expect(redacted).not.toContain('sk-proj-1234567890abcdef1234567890');
    expect(redacted).not.toContain('sk-ant-api03-abcdefghijklmnopqrstuvwxyz123456');
    expect(redacted).not.toContain('AIzaSyD987654321abcdefghijklmnopqrstuv');
    expect(redacted).toContain('[REDACTED]');
  });

  it('masks API keys safely for UI display', () => {
    const masked = SecretRedactor.maskApiKey('sk-proj-1234567890abcdef1234');
    expect(masked).toBe('sk-p...1234');
  });

  it('PermissionBroker enforces Ask, Supervised, and Autonomous modes', async () => {
    const broker = new PermissionBroker('supervised');

    // Supervised mode allows safe commands
    const allowed = await broker.evaluateAction({
      taskId: 'test_1',
      actionType: 'shell_exec',
      target: 'bash',
      command: 'make -j4',
      reason: 'Build project',
    });
    expect(allowed).toBe(true);

    // Ask mode requires user prompt for every action
    broker.setAutonomyLevel('ask');
    let promptTriggered = false;
    broker.setPromptHandler(async (req) => {
      promptTriggered = true;
      return { requestId: req.id, approved: true };
    });

    const res = await broker.evaluateAction({
      taskId: 'test_2',
      actionType: 'file_edit',
      target: 'test.cpp',
      reason: 'Create file',
    });

    expect(promptTriggered).toBe(true);
    expect(res).toBe(true);
  });
});

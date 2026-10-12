import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { WorkspaceService } from '@ai-ide/workspace';
import { ShellRegistry } from '@ai-ide/shell-adapters';
import { AIProviderRegistry } from '@ai-ide/ai-providers';
import { PermissionBroker } from '@ai-ide/security';
import { ToolchainManager } from '@ai-ide/toolchain-manager';
import { GitService } from '@ai-ide/git-integration';
import { AgentOrchestrator, PersistentMemory } from '@ai-ide/agent-core';

describe('Autonomous AI Agent End-to-End Loop Integration Test', () => {
  const sandboxDir = path.resolve(__dirname, '../../test-agent-sandbox');

  beforeEach(() => {
    if (fs.existsSync(sandboxDir)) {
      fs.rmSync(sandboxDir, { recursive: true, force: true });
    }
    fs.mkdirSync(sandboxDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(sandboxDir)) {
      fs.rmSync(sandboxDir, { recursive: true, force: true });
    }
  });

  it('orchestrator creates plan, creates C++ files, compiles with g++, verifies output and evidence', async () => {
    const workspace = new WorkspaceService(sandboxDir);
    const shellReg = new ShellRegistry();
    const aiReg = new AIProviderRegistry();
    const permBroker = new PermissionBroker('supervised');
    const toolchainMgr = new ToolchainManager();
    const git = new GitService(sandboxDir);
    const mem = new PersistentMemory();

    const orchestrator = new AgentOrchestrator(
      workspace,
      shellReg,
      aiReg,
      permBroker,
      toolchainMgr,
      git,
      mem
    );

    const emittedEvents: string[] = [];
    orchestrator.onEvent((event) => {
      emittedEvents.push(event.type);
    });

    const summary = await orchestrator.runTask(
      'Create a C++ project and build it',
      'supervised'
    );

    expect(summary.status).toBe('completed');

    // Verify main.cpp was actually written by the agent
    const mainCppPath = path.join(sandboxDir, 'main.cpp');
    expect(fs.existsSync(mainCppPath)).toBe(true);

    const content = fs.readFileSync(mainCppPath, 'utf-8');
    expect(content).toContain('main()');
    expect(content).toContain('#include <iostream>');

    // Verify app binary was actually compiled
    const appBinaryPath = path.join(sandboxDir, 'app');
    expect(fs.existsSync(appBinaryPath)).toBe(true);

    // Verify lifecycle events were emitted
    expect(emittedEvents).toContain('status_changed');
    expect(emittedEvents).toContain('plan_updated');
    expect(emittedEvents).toContain('step_started');
    expect(emittedEvents).toContain('step_completed');
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { WorkspaceService } from '@ai-ide/workspace';

describe('Workspace File Operations Integration Tests', () => {
  const testDir = path.resolve(__dirname, '../../test-workspace-sandbox');
  let service: WorkspaceService;

  beforeEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
    service = new WorkspaceService(testDir);
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('creates, reads, writes, searches, patches, and lists files', () => {
    // 1. Create file
    service.createFile('hello.txt', 'Initial Content line 1\nTarget line 2\n');
    expect(fs.existsSync(path.join(testDir, 'hello.txt'))).toBe(true);

    // 2. Read file
    const content = service.readFile('hello.txt');
    expect(content).toContain('Initial Content line 1');

    // 3. Search
    const searchResults = service.search('Target');
    expect(searchResults.length).toBe(1);
    expect(searchResults[0].line).toBe(2);

    // 4. Patch
    service.applyPatch('hello.txt', 'Target line 2', 'Replaced line 2');
    const updated = service.readFile('hello.txt');
    expect(updated).toContain('Replaced line 2');
    expect(updated).not.toContain('Target line 2');

    // 5. List
    const files = service.listFiles();
    expect(files.some((f) => f.name === 'hello.txt')).toBe(true);

    // 6. Delete
    service.deletePath('hello.txt');
    expect(fs.existsSync(path.join(testDir, 'hello.txt'))).toBe(false);
  });
});

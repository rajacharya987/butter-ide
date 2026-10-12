import { exec } from 'node:child_process';
import * as path from 'node:path';
import {
  GitStatusResult,
  GitFileStatus,
  GitCommit,
} from '@ai-ide/shared';

export class GitService {
  private workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = path.resolve(workspaceRoot);
  }

  private execGit(cmd: string, cwd?: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const targetDir = cwd || this.workspaceRoot;
    return new Promise((resolve) => {
      exec(cmd, { cwd: targetDir, timeout: 15000 }, (error, stdout, stderr) => {
        resolve({
          stdout: stdout.toString(),
          stderr: stderr.toString(),
          exitCode: error ? (typeof error.code === 'number' ? error.code : 1) : 0,
        });
      });
    });
  }

  public async isGitRepo(cwd?: string): Promise<boolean> {
    const { exitCode } = await this.execGit('git rev-parse --is-inside-work-tree', cwd);
    return exitCode === 0;
  }

  public async initRepo(cwd?: string): Promise<void> {
    const { exitCode, stderr } = await this.execGit('git init', cwd);
    if (exitCode !== 0) {
      throw new Error(`git init failed: ${stderr}`);
    }
  }

  public async getStatus(cwd?: string): Promise<GitStatusResult> {
    const isRepo = await this.isGitRepo(cwd);
    if (!isRepo) {
      return {
        currentBranch: 'none',
        isClean: true,
        staged: [],
        unstaged: [],
        untracked: [],
        ahead: 0,
        behind: 0,
      };
    }

    const { stdout, exitCode } = await this.execGit('git status --porcelain=v1 -b', cwd);
    if (exitCode !== 0) {
      throw new Error('Failed to retrieve git status');
    }

    const lines = stdout.split('\n').filter((l) => l.trim().length > 0);
    let currentBranch = 'main';
    let ahead = 0;
    let behind = 0;

    const staged: GitFileStatus[] = [];
    const unstaged: GitFileStatus[] = [];
    const untracked: string[] = [];

    for (const line of lines) {
      if (line.startsWith('## ')) {
        const branchLine = line.slice(3);
        const match = branchLine.match(/^([^\s\.]+)/);
        if (match) currentBranch = match[1];

        const aheadMatch = branchLine.match(/ahead (\d+)/);
        if (aheadMatch) ahead = parseInt(aheadMatch[1], 10);

        const behindMatch = branchLine.match(/behind (\d+)/);
        if (behindMatch) behind = parseInt(behindMatch[1], 10);
        continue;
      }

      const x = line[0];
      const y = line[1];
      const filePath = line.slice(3).trim();

      if (x === '?' && y === '?') {
        untracked.push(filePath);
        continue;
      }

      if (x !== ' ' && x !== '?') {
        staged.push({
          path: filePath,
          status: x === 'A' ? 'added' : x === 'D' ? 'deleted' : x === 'R' ? 'renamed' : 'modified',
        });
      }

      if (y !== ' ' && y !== '?') {
        unstaged.push({
          path: filePath,
          status: y === 'D' ? 'deleted' : 'modified',
        });
      }
    }

    const isClean = staged.length === 0 && unstaged.length === 0 && untracked.length === 0;

    return {
      currentBranch,
      isClean,
      staged,
      unstaged,
      untracked,
      ahead,
      behind,
    };
  }

  public async getDiff(filePath?: string, staged = false, cwd?: string): Promise<string> {
    const isRepo = await this.isGitRepo(cwd);
    if (!isRepo) return '';

    const flags = staged ? '--cached' : '';
    const fileArg = filePath ? ` -- "${filePath}"` : '';
    const { stdout } = await this.execGit(`git diff ${flags}${fileArg}`, cwd);
    return stdout;
  }

  public async stage(filePaths: string[], cwd?: string): Promise<void> {
    const files = filePaths.map((f) => `"${f}"`).join(' ');
    const { exitCode, stderr } = await this.execGit(`git add ${files}`, cwd);
    if (exitCode !== 0) throw new Error(`git add failed: ${stderr}`);
  }

  public async unstage(filePaths: string[], cwd?: string): Promise<void> {
    const files = filePaths.map((f) => `"${f}"`).join(' ');
    const { exitCode, stderr } = await this.execGit(`git restore --staged ${files}`, cwd);
    if (exitCode !== 0) throw new Error(`git restore failed: ${stderr}`);
  }

  public async commit(message: string, cwd?: string): Promise<void> {
    const sanitized = message.replace(/"/g, '\\"');
    const { exitCode, stderr } = await this.execGit(`git commit -m "${sanitized}"`, cwd);
    if (exitCode !== 0) throw new Error(`git commit failed: ${stderr}`);
  }

  public async createBranch(branchName: string, cwd?: string): Promise<void> {
    const { exitCode, stderr } = await this.execGit(`git checkout -b "${branchName}"`, cwd);
    if (exitCode !== 0) throw new Error(`git checkout -b failed: ${stderr}`);
  }

  public async checkout(branchOrCommit: string, cwd?: string): Promise<void> {
    const { exitCode, stderr } = await this.execGit(`git checkout "${branchOrCommit}"`, cwd);
    if (exitCode !== 0) throw new Error(`git checkout failed: ${stderr}`);
  }

  public async getLog(limit = 20, cwd?: string): Promise<GitCommit[]> {
    const isRepo = await this.isGitRepo(cwd);
    if (!isRepo) return [];

    const format = '%H|%h|%an|%ad|%s';
    const { stdout, exitCode } = await this.execGit(
      `git log -n ${limit} --pretty=format:"${format}" --date=short`,
      cwd
    );
    if (exitCode !== 0) return [];

    const commits: GitCommit[] = [];
    const lines = stdout.split('\n').filter((l) => l.trim().length > 0);

    for (const line of lines) {
      const parts = line.split('|');
      if (parts.length >= 5) {
        commits.push({
          hash: parts[0],
          shortHash: parts[1],
          author: parts[2],
          date: parts[3],
          message: parts.slice(4).join('|'),
        });
      }
    }

    return commits;
  }
}

import * as fs from 'node:fs';
import * as path from 'node:path';
import { FileNode } from '@ai-ide/shared';
import { PathValidator } from '@ai-ide/security';

export class WorkspaceService {
  private workspaceRoot: string;

  private static readonly IGNORED_NAMES = new Set([
    'node_modules',
    '.git',
    'dist',
    'build',
    'target',
    '.venv',
    'venv',
    '__pycache__',
    '.turbo',
    '.next',
    'obj',
    'bin',
  ]);

  constructor(workspaceRoot: string) {
    this.workspaceRoot = path.resolve(workspaceRoot);
  }

  public getRoot(): string {
    return this.workspaceRoot;
  }

  public setRoot(newRoot: string): void {
    this.workspaceRoot = path.resolve(newRoot);
  }

  public listFiles(subDir?: string, depth = 5): FileNode[] {
    const targetDir = subDir
      ? PathValidator.assertSafeWorkspacePath(subDir, this.workspaceRoot)
      : this.workspaceRoot;

    return this.scanDirectory(targetDir, depth, 0);
  }

  private scanDirectory(currentPath: string, maxDepth: number, currentDepth: number): FileNode[] {
    if (currentDepth >= maxDepth) return [];
    if (!fs.existsSync(currentPath)) return [];

    const results: FileNode[] = [];
    try {
      const entries = fs.readdirSync(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        if (WorkspaceService.IGNORED_NAMES.has(entry.name)) {
          continue;
        }

        const fullPath = path.join(currentPath, entry.name);
        const isDirectory = entry.isDirectory();

        let size: number | undefined = undefined;
        let modifiedTime: number | undefined = undefined;

        try {
          const stats = fs.statSync(fullPath);
          size = stats.size;
          modifiedTime = stats.mtimeMs;
        } catch {
          // stats error ignored
        }

        const node: FileNode = {
          name: entry.name,
          path: fullPath,
          isDirectory,
          size,
          modifiedTime,
          children: isDirectory
            ? this.scanDirectory(fullPath, maxDepth, currentDepth + 1)
            : undefined,
        };

        results.push(node);
      }
    } catch {
      // Permission or reading error
    }

    return results.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  public readFile(filePath: string): string {
    const safePath = PathValidator.assertSafeWorkspacePath(filePath, this.workspaceRoot);
    if (!fs.existsSync(safePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const stat = fs.statSync(safePath);
    if (stat.size > 10 * 1024 * 1024) {
      throw new Error(`File is too large to open directly (${Math.round(stat.size / 1024 / 1024)}MB)`);
    }

    return fs.readFileSync(safePath, 'utf-8');
  }

  public writeFile(filePath: string, content: string): void {
    const safePath = PathValidator.assertSafeWorkspacePath(filePath, this.workspaceRoot);
    const dir = path.dirname(safePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(safePath, content, 'utf-8');
  }

  public createFile(filePath: string, content = ''): void {
    const safePath = PathValidator.assertSafeWorkspacePath(filePath, this.workspaceRoot);
    if (fs.existsSync(safePath)) {
      throw new Error(`File already exists: ${filePath}`);
    }
    this.writeFile(safePath, content);
  }

  public createDirectory(dirPath: string): void {
    const safePath = PathValidator.assertSafeWorkspacePath(dirPath, this.workspaceRoot);
    if (!fs.existsSync(safePath)) {
      fs.mkdirSync(safePath, { recursive: true });
    }
  }

  public deletePath(targetPath: string): void {
    const safePath = PathValidator.assertSafeWorkspacePath(targetPath, this.workspaceRoot);
    if (!fs.existsSync(safePath)) return;

    const stat = fs.statSync(safePath);
    if (stat.isDirectory()) {
      fs.rmSync(safePath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(safePath);
    }
  }

  public applyPatch(filePath: string, search: string, replace: string): void {
    const current = this.readFile(filePath);
    if (!current.includes(search)) {
      throw new Error(`Patch target not found in ${filePath}`);
    }
    const updated = current.replace(search, replace);
    this.writeFile(filePath, updated);
  }

  public search(
    query: string,
    options?: { matchCase?: boolean; isRegex?: boolean }
  ): Array<{ path: string; line: number; text: string }> {
    const matches: Array<{ path: string; line: number; text: string }> = [];
    if (!query) return matches;

    let regex: RegExp;
    try {
      const flags = options?.matchCase ? 'g' : 'gi';
      const pattern = options?.isRegex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      regex = new RegExp(pattern, flags);
    } catch {
      return matches;
    }

    const traverse = (dir: string) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (WorkspaceService.IGNORED_NAMES.has(entry.name)) continue;
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            traverse(fullPath);
          } else if (entry.isFile()) {
            // Check file extension / skip binaries
            const ext = path.extname(entry.name).toLowerCase();
            const binaryExts = new Set(['.png', '.jpg', '.jpeg', '.gif', '.bin', '.exe', '.o', '.so', '.dll', '.zip', '.tar', '.gz']);
            if (binaryExts.has(ext)) continue;

            try {
              const content = fs.readFileSync(fullPath, 'utf-8');
              const lines = content.split('\n');
              for (let i = 0; i < lines.length; i++) {
                if (regex.test(lines[i])) {
                  matches.push({
                    path: path.relative(this.workspaceRoot, fullPath),
                    line: i + 1,
                    text: lines[i].trim(),
                  });
                  if (matches.length >= 200) return; // limit search results
                }
              }
            } catch {
              // Binary or unreadable file
            }
          }
        }
      } catch {
        // Read dir error
      }
    };

    traverse(this.workspaceRoot);
    return matches;
  }
}

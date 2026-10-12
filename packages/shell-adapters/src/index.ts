import * as os from 'node:os';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawn, exec } from 'node:child_process';
import {
  OSInfo,
  OSType,
  ShellType,
  ShellProfile,
  ShellCapability,
  ExecutionResult,
  ShellMode,
} from '@ai-ide/shared';

// ==========================================
// 1. Operating System Detector
// ==========================================

export class OSDetector {
  private static cachedOSInfo: OSInfo | null = null;

  public static getOSInfo(): OSInfo {
    if (this.cachedOSInfo) {
      return this.cachedOSInfo;
    }

    const platform = process.platform as 'linux' | 'win32' | 'darwin';
    const arch = os.arch();
    const release = os.release();

    let osType: OSType = 'unknown';
    let distName: string = platform;
    let distVersion: string | undefined = undefined;

    if (platform === 'win32') {
      osType = 'windows';
      distName = `Windows ${release}`;
    } else if (platform === 'darwin') {
      osType = 'macos';
      distName = `macOS ${release}`;
    } else if (platform === 'linux') {
      osType = 'linux';
      distName = 'Generic Linux';

      if (fs.existsSync('/etc/os-release')) {
        try {
          const content = fs.readFileSync('/etc/os-release', 'utf-8');
          const lines = content.split('\n');
          const releaseMap: Record<string, string> = {};

          for (const line of lines) {
            const match = line.match(/^([A-Z_]+)="?(.*?)"?$/);
            if (match) {
              releaseMap[match[1]] = match[2];
            }
          }

          const id = (releaseMap['ID'] || '').toLowerCase();
          const idLike = (releaseMap['ID_LIKE'] || '').toLowerCase();
          distName = releaseMap['PRETTY_NAME'] || releaseMap['NAME'] || 'Linux';
          distVersion = releaseMap['VERSION_ID'];

          if (id === 'arch' || idLike.includes('arch') || fs.existsSync('/etc/arch-release')) {
            osType = 'arch';
          } else if (id === 'ubuntu' || idLike.includes('ubuntu')) {
            osType = 'ubuntu';
          } else if (id === 'debian' || idLike.includes('debian')) {
            osType = 'debian';
          } else if (id === 'fedora' || idLike.includes('fedora')) {
            osType = 'fedora';
          }
        } catch {
          // Fallback to generic linux
        }
      }
    }

    let defaultRecommendedShell: ShellType = 'bash';
    if (osType === 'windows') {
      defaultRecommendedShell = 'powershell';
    } else if (osType === 'macos') {
      defaultRecommendedShell = 'zsh';
    } else if (osType === 'arch' || osType === 'ubuntu' || osType === 'debian') {
      defaultRecommendedShell = 'razzshell';
    }

    this.cachedOSInfo = {
      osType,
      platform,
      distName,
      distVersion,
      arch,
      release,
      isArch: osType === 'arch',
      isUbuntuOrDebian: osType === 'ubuntu' || osType === 'debian',
      isWindows: osType === 'windows',
      isMacOS: osType === 'macos',
      defaultRecommendedShell,
    };

    return this.cachedOSInfo;
  }
}

// ==========================================
// 2. Base Shell Adapter Interface
// ==========================================

export interface ShellAdapter {
  shellType: ShellType;
  name: string;
  description: string;
  isAvailable(): Promise<boolean>;
  getExecutablePath(): Promise<string | null>;
  getVersion(): Promise<string | undefined>;
  getCapabilities(): ShellCapability[];
  getSpawnConfig(
    cwd: string,
    env?: Record<string, string>,
    mode?: ShellMode
  ): { executable: string; args: string[]; env: Record<string, string> };
  formatCommandLine(command: string): { executable: string; args: string[] };
  executeCommand(
    command: string,
    cwd: string,
    env?: Record<string, string>,
    timeoutMs?: number
  ): Promise<ExecutionResult>;
  getInstallationGuide(osInfo: OSInfo): string;
}

// ==========================================
// 3. RazzShell Adapter
// ==========================================

export class RazzShellAdapter implements ShellAdapter {
  public readonly shellType: ShellType = 'razzshell';
  public readonly name = 'RazzShell';
  public readonly description =
    'First-class AI & cyber-enhanced shell with Universal Undo, built-in AI diagnostics, and cyber prompts';

  private cachedPath: string | null = null;
  private cachedVersion: string | undefined = undefined;

  public async getExecutablePath(): Promise<string | null> {
    if (this.cachedPath && fs.existsSync(this.cachedPath)) {
      return this.cachedPath;
    }

    const localBin = path.join(os.homedir(), '.local/bin/razzshell');
    const userBin = path.join(os.homedir(), 'bin/razzshell');

    // User-installed modern binaries come first
    const candidatePaths = [
      localBin,
      userBin,
      '/home/dedsec/.local/bin/razzshell',
      '/usr/bin/razzshell',
      '/usr/local/bin/razzshell',
    ];

    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        try {
          fs.accessSync(p, fs.constants.X_OK);
          this.cachedPath = p;
          return p;
        } catch {
          // not executable
        }
      }
    }

    return new Promise((resolve) => {
      exec('which razzshell', { timeout: 2000 }, (error, stdout) => {
        if (!error && stdout.trim()) {
          const found = stdout.trim();
          this.cachedPath = found;
          resolve(found);
        } else {
          resolve(null);
        }
      });
    });
  }

  public async isAvailable(): Promise<boolean> {
    const execPath = await this.getExecutablePath();
    return execPath !== null;
  }

  public async getVersion(): Promise<string | undefined> {
    if (this.cachedVersion) return this.cachedVersion;
    const execPath = await this.getExecutablePath();
    if (!execPath) return undefined;

    return new Promise((resolve) => {
      exec(`"${execPath}" --version`, { timeout: 2000 }, (error, stdout) => {
        if (!error && stdout) {
          const match = stdout.match(/version\s+([0-9.]+)/i);
          this.cachedVersion = match ? match[1] : '2.0.0';
          resolve(this.cachedVersion);
        } else {
          this.cachedVersion = '2.0.0';
          resolve('2.0.0');
        }
      });
    });
  }

  public getCapabilities(): ShellCapability[] {
    return [
      {
        shellType: 'razzshell',
        name: 'Directory Navigation',
        command: 'change',
        posixEquivalent: 'cd',
        description: 'Change the current working directory',
        category: 'navigation',
        example: 'change src/components',
      },
      {
        shellType: 'razzshell',
        name: 'List Contents',
        command: 'list',
        posixEquivalent: 'ls',
        description: 'List directory contents with color-coded cyber output',
        category: 'navigation',
        example: 'list -a',
      },
      {
        shellType: 'razzshell',
        name: 'Print Working Directory',
        command: 'where',
        posixEquivalent: 'pwd',
        description: 'Display working directory or filter pipeline output',
        category: 'navigation',
        example: 'where',
      },
      {
        shellType: 'razzshell',
        name: 'Create File',
        command: 'create',
        posixEquivalent: 'touch',
        description: 'Create a new empty file',
        category: 'file_ops',
        example: 'create main.cpp',
      },
      {
        shellType: 'razzshell',
        name: 'Make Directory',
        command: 'makedir',
        posixEquivalent: 'mkdir',
        description: 'Create a new directory',
        category: 'file_ops',
        example: 'makedir build',
      },
      {
        shellType: 'razzshell',
        name: 'Remove Directory',
        command: 'removedir',
        posixEquivalent: 'rmdir',
        description: 'Remove an empty directory',
        category: 'file_ops',
        example: 'removedir old_dir',
      },
      {
        shellType: 'razzshell',
        name: 'Delete File',
        command: 'delete',
        posixEquivalent: 'rm',
        description: 'Safely delete a file (backed by trash for undo)',
        category: 'file_ops',
        example: 'delete temp.txt',
      },
      {
        shellType: 'razzshell',
        name: 'Copy File',
        command: 'copy',
        posixEquivalent: 'cp',
        description: 'Copy files from source to destination',
        category: 'file_ops',
        example: 'copy config.json config.backup.json',
      },
      {
        shellType: 'razzshell',
        name: 'Move/Rename File',
        command: 'move',
        posixEquivalent: 'mv',
        description: 'Move or rename files and directories',
        category: 'file_ops',
        example: 'move old_name.ts new_name.ts',
      },
      {
        shellType: 'razzshell',
        name: 'Read File',
        command: 'readfile',
        posixEquivalent: 'cat',
        description: 'Display file contents to stdout',
        category: 'file_ops',
        example: 'readfile package.json',
      },
      {
        shellType: 'razzshell',
        name: 'Search Files',
        command: 'searchfile',
        posixEquivalent: 'find',
        description: 'Search for files matching name patterns in hierarchy',
        category: 'file_ops',
        example: 'searchfile index.ts',
      },
      {
        shellType: 'razzshell',
        name: 'Search Text',
        command: 'searchtext',
        posixEquivalent: 'grep',
        description: 'Search for text pattern inside files',
        category: 'file_ops',
        example: 'searchtext "TODO" src/main.cpp',
      },
      {
        shellType: 'razzshell',
        name: 'Universal Undo',
        command: 'undo',
        description: 'Revert last reversible action (file deletion, move, git commit, etc.)',
        category: 'file_ops',
        example: 'undo',
      },
      {
        shellType: 'razzshell',
        name: 'Show Processes',
        command: 'processes',
        posixEquivalent: 'ps',
        description: 'List running processes in structured table format (PID, Name)',
        category: 'process',
        example: 'processes',
      },
      {
        shellType: 'razzshell',
        name: 'Terminate Process',
        command: 'terminate',
        posixEquivalent: 'kill',
        description: 'Terminate process by PID or pipe',
        category: 'process',
        example: 'terminate 1234',
      },
      {
        shellType: 'razzshell',
        name: 'Echo Text',
        command: 'say',
        posixEquivalent: 'echo',
        description: 'Display a line of text to terminal',
        category: 'utility',
        example: 'say "Building target..."',
      },
      {
        shellType: 'razzshell',
        name: 'AI Error Explanation',
        command: 'why',
        description: 'Explain why the last compiler or build command failed',
        category: 'ai',
        example: 'why',
      },
      {
        shellType: 'razzshell',
        name: 'AI Command Fix',
        command: 'fix',
        description: 'Analyze last failed command and propose interactive fix',
        category: 'ai',
        example: 'fix',
      },
      {
        shellType: 'razzshell',
        name: 'Command Help',
        command: 'howto',
        posixEquivalent: 'help',
        description: 'Display built-in command help and usage syntax',
        category: 'utility',
        example: 'howto',
      },
    ];
  }

  public getSpawnConfig(
    cwd: string,
    env?: Record<string, string>,
    mode: ShellMode = 'native'
  ): { executable: string; args: string[]; env: Record<string, string> } {
    let executable = this.cachedPath;
    if (!executable) {
      const candidates = [
        path.join(os.homedir(), '.local/bin/razzshell'),
        path.join(os.homedir(), 'bin/razzshell'),
        '/home/dedsec/.local/bin/razzshell',
        '/usr/bin/razzshell',
        '/usr/local/bin/razzshell',
      ];
      for (const c of candidates) {
        if (fs.existsSync(c)) {
          executable = c;
          this.cachedPath = c;
          break;
        }
      }
    }
    if (!executable) executable = 'razzshell';

    const args: string[] = [];
    if (mode === 'posix') {
      args.push('--posix');
    } else if (mode === 'bash') {
      args.push('--bash');
    }

    const localBin = path.join(os.homedir(), '.local/bin');
    const userPath = `${localBin}:${path.join(os.homedir(), 'bin')}:${process.env.PATH || '/usr/local/bin:/usr/bin:/bin'}`;

    return {
      executable,
      args,
      env: {
        ...process.env,
        ...env,
        PATH: userPath,
        SHELL: executable,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
      } as Record<string, string>,
    };
  }

  public formatCommandLine(command: string): { executable: string; args: string[] } {
    const executable = this.cachedPath || 'razzshell';
    // For non-interactive execution, pass commands into stdin or via bash mode
    return {
      executable,
      args: ['--bash', '-c', command],
    };
  }

  public async executeCommand(
    command: string,
    cwd: string,
    env?: Record<string, string>,
    timeoutMs: number = 30000
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const executable = await this.getExecutablePath();

    if (!executable) {
      return {
        command,
        shellType: 'razzshell',
        cwd,
        exitCode: 127,
        stdout: '',
        stderr: 'RazzShell binary not found on this system.',
        durationMs: 0,
        error: 'RazzShell executable not found',
      };
    }

    return new Promise((resolve) => {
      // Execute via RazzShell stdin pipe to preserve native built-in commands
      const child = spawn(executable, [], {
        cwd,
        env: { ...process.env, ...env, TERM: 'dumb' },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
      }, timeoutMs);

      child.stdout.on('data', (d) => {
        stdout += d.toString();
      });

      child.stderr.on('data', (d) => {
        stderr += d.toString();
      });

      // Write the command followed by quit
      child.stdin.write(`${command}\nquit\n`);
      child.stdin.end();

      child.on('close', (code) => {
        clearTimeout(timer);
        const durationMs = Date.now() - startTime;

        // Clean prompt banner artifacts from stdout for cleaner machine parsing if needed
        const cleanStdout = stdout
          .replace(/╔═+╗\s*║\s*razzshell-[\$#].*?>\s*/g, '')
          .replace(/quit\s*$/g, '')
          .trim();

        const isErrorOutput =
          cleanStdout.toLowerCase().includes('command not found') ||
          cleanStdout.toLowerCase().includes('not found') ||
          cleanStdout.toLowerCase().includes('no such file') ||
          cleanStdout.toLowerCase().includes('cannot execute');

        const effectiveExitCode = timedOut
          ? 124
          : isErrorOutput && (code === 0 || code === null)
          ? 127
          : (code ?? 0);

        resolve({
          command,
          shellType: 'razzshell',
          cwd,
          exitCode: effectiveExitCode,
          stdout: cleanStdout,
          stderr: timedOut ? `${stderr}\nCommand timed out after ${timeoutMs}ms` : stderr,
          durationMs,
          error: timedOut ? 'Command timed out' : effectiveExitCode !== 0 ? 'Command execution error' : undefined,
        });
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        resolve({
          command,
          shellType: 'razzshell',
          cwd,
          exitCode: 1,
          stdout,
          stderr: err.message,
          durationMs: Date.now() - startTime,
          error: err.message,
        });
      });
    });
  }

  public getInstallationGuide(osInfo: OSInfo): string {
    if (osInfo.isArch) {
      return `### Installing RazzShell on Arch Linux

**Option 1: Using yay (AUR)**
\`\`\`bash
yay -S razzshell
\`\`\`

**Option 2: One-Click Build from Official Repository**
\`\`\`bash
sudo pacman -S --needed base-devel readline ncurses git
git clone https://github.com/rajacharya987/razzshell.git
cd razzshell
make clean && make
sudo install -Dm755 razzshell /usr/local/bin/razzshell
\`\`\``;
    } else if (osInfo.isUbuntuOrDebian) {
      return `### Installing RazzShell on Ubuntu/Debian

\`\`\`bash
sudo apt-get update
sudo apt-get install -y build-essential libreadline-dev libncurses5-dev git
git clone https://github.com/rajacharya987/razzshell.git
cd razzshell
make clean && make
sudo install -Dm755 razzshell /usr/local/bin/razzshell
\`\`\``;
    } else {
      return `### Installing RazzShell from Source
Ensure GCC, readline, and ncurses are installed:
\`\`\`bash
git clone https://github.com/rajacharya987/razzshell.git
cd razzshell
make clean && make
sudo install -Dm755 razzshell /usr/local/bin/razzshell
\`\`\``;
    }
  }
}

// ==========================================
// 4. PowerShell Adapter (Windows & Cross-Platform)
// ==========================================

export class PowerShellAdapter implements ShellAdapter {
  public readonly shellType: ShellType = 'powershell';
  public readonly name = 'PowerShell';
  public readonly description =
    'Standard Windows shell with object pipelines, cmdlet ecosystem, and PowerShell 7';

  private cachedPath: string | null = null;

  public async getExecutablePath(): Promise<string | null> {
    if (this.cachedPath) return this.cachedPath;

    // Check for pwsh (PowerShell Core 7) first, then powershell.exe
    const candidates =
      process.platform === 'win32'
        ? ['pwsh.exe', 'powershell.exe']
        : ['pwsh'];

    for (const bin of candidates) {
      const exists = await new Promise<boolean>((resolve) => {
        exec(
          process.platform === 'win32' ? `where ${bin}` : `which ${bin}`,
          { timeout: 2000 },
          (err) => {
            resolve(!err);
          }
        );
      });
      if (exists) {
        this.cachedPath = bin;
        return bin;
      }
    }
    return null;
  }

  public async isAvailable(): Promise<boolean> {
    const p = await this.getExecutablePath();
    return p !== null;
  }

  public async getVersion(): Promise<string | undefined> {
    const bin = await this.getExecutablePath();
    if (!bin) return undefined;

    return new Promise((resolve) => {
      exec(`"${bin}" -NoProfile -Command "$PSVersionTable.PSVersion.ToString()"`, (err, stdout) => {
        if (!err && stdout.trim()) {
          resolve(stdout.trim());
        } else {
          resolve('5.1');
        }
      });
    });
  }

  public getCapabilities(): ShellCapability[] {
    return [
      {
        shellType: 'powershell',
        name: 'Get Child Item',
        command: 'Get-ChildItem',
        posixEquivalent: 'ls',
        description: 'Lists files and folders',
        category: 'navigation',
        example: 'Get-ChildItem -Force',
      },
      {
        shellType: 'powershell',
        name: 'Set Location',
        command: 'Set-Location',
        posixEquivalent: 'cd',
        description: 'Sets the working directory',
        category: 'navigation',
        example: 'Set-Location src',
      },
      {
        shellType: 'powershell',
        name: 'Out-String & Filter',
        command: 'Where-Object',
        posixEquivalent: 'grep',
        description: 'Filter objects in pipeline',
        category: 'utility',
        example: 'Get-Process | Where-Object { $_.CPU -gt 10 }',
      },
    ];
  }

  public getSpawnConfig(
    cwd: string,
    env?: Record<string, string>
  ): { executable: string; args: string[]; env: Record<string, string> } {
    const executable = this.cachedPath || (process.platform === 'win32' ? 'powershell.exe' : 'pwsh');
    return {
      executable,
      args: ['-NoLogo', '-NoExit', '-ExecutionPolicy', 'Bypass'],
      env: { ...process.env, ...env } as Record<string, string>,
    };
  }

  public formatCommandLine(command: string): { executable: string; args: string[] } {
    const executable = this.cachedPath || (process.platform === 'win32' ? 'powershell.exe' : 'pwsh');
    return {
      executable,
      args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command],
    };
  }

  public async executeCommand(
    command: string,
    cwd: string,
    env?: Record<string, string>,
    timeoutMs: number = 30000
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const executable = (await this.getExecutablePath()) || 'pwsh';

    return new Promise((resolve) => {
      const child = spawn(
        executable,
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command],
        {
          cwd,
          env: { ...process.env, ...env },
        }
      );

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
      }, timeoutMs);

      child.stdout?.on('data', (d) => (stdout += d.toString()));
      child.stderr?.on('data', (d) => (stderr += d.toString()));

      child.on('close', (code) => {
        clearTimeout(timer);
        resolve({
          command,
          shellType: 'powershell',
          cwd,
          exitCode: timedOut ? 124 : (code ?? 0),
          stdout,
          stderr: timedOut ? `${stderr}\nTimed out` : stderr,
          durationMs: Date.now() - startTime,
          error: timedOut ? 'Command timed out' : undefined,
        });
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        resolve({
          command,
          shellType: 'powershell',
          cwd,
          exitCode: 1,
          stdout,
          stderr: err.message,
          durationMs: Date.now() - startTime,
          error: err.message,
        });
      });
    });
  }

  public getInstallationGuide(): string {
    return `### Installing PowerShell 7
- **Windows**: \`winget install --id Microsoft.PowerShell --source winget\`
- **Linux (Arch)**: \`yay -S powershell-bin\`
- **Linux (Ubuntu)**: \`sudo apt-get install -y powershell\`
- **macOS**: \`brew install --cask powershell\``;
  }
}

// ==========================================
// 5. Bash Adapter
// ==========================================

export class BashAdapter implements ShellAdapter {
  public readonly shellType: ShellType = 'bash';
  public readonly name = 'Bash';
  public readonly description = 'Standard GNU Bourne Again Shell';

  private cachedPath: string | null = null;

  public async getExecutablePath(): Promise<string | null> {
    if (this.cachedPath) return this.cachedPath;
    const paths = ['/bin/bash', '/usr/bin/bash'];
    for (const p of paths) {
      if (fs.existsSync(p)) {
        this.cachedPath = p;
        return p;
      }
    }
    return 'bash';
  }

  public async isAvailable(): Promise<boolean> {
    return process.platform !== 'win32' || fs.existsSync('C:\\Program Files\\Git\\bin\\bash.exe');
  }

  public async getVersion(): Promise<string | undefined> {
    const bin = (await this.getExecutablePath()) || 'bash';
    return new Promise((resolve) => {
      exec(`"${bin}" --version`, (err, stdout) => {
        if (!err && stdout) {
          const match = stdout.match(/version\s+([0-9.]+)/i);
          resolve(match ? match[1] : '5.x');
        } else {
          resolve(undefined);
        }
      });
    });
  }

  public getCapabilities(): ShellCapability[] {
    return [
      {
        shellType: 'bash',
        name: 'List Directory',
        command: 'ls',
        description: 'List directory contents',
        category: 'navigation',
        example: 'ls -la',
      },
      {
        shellType: 'bash',
        name: 'Change Directory',
        command: 'cd',
        description: 'Change directory',
        category: 'navigation',
        example: 'cd src',
      },
    ];
  }

  public getSpawnConfig(
    cwd: string,
    env?: Record<string, string>
  ): { executable: string; args: string[]; env: Record<string, string> } {
    const executable = this.cachedPath || '/bin/bash';
    return {
      executable,
      args: ['--login'],
      env: { ...process.env, ...env, TERM: 'xterm-256color' } as Record<string, string>,
    };
  }

  public formatCommandLine(command: string): { executable: string; args: string[] } {
    return {
      executable: this.cachedPath || 'bash',
      args: ['-c', command],
    };
  }

  public async executeCommand(
    command: string,
    cwd: string,
    env?: Record<string, string>,
    timeoutMs: number = 30000
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const executable = (await this.getExecutablePath()) || 'bash';

    return new Promise((resolve) => {
      const child = spawn(executable, ['-c', command], {
        cwd,
        env: { ...process.env, ...env },
      });

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
      }, timeoutMs);

      child.stdout?.on('data', (d) => (stdout += d.toString()));
      child.stderr?.on('data', (d) => (stderr += d.toString()));

      child.on('close', (code) => {
        clearTimeout(timer);
        resolve({
          command,
          shellType: 'bash',
          cwd,
          exitCode: timedOut ? 124 : (code ?? 0),
          stdout,
          stderr: timedOut ? `${stderr}\nTimed out` : stderr,
          durationMs: Date.now() - startTime,
          error: timedOut ? 'Command timed out' : undefined,
        });
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        resolve({
          command,
          shellType: 'bash',
          cwd,
          exitCode: 1,
          stdout,
          stderr: err.message,
          durationMs: Date.now() - startTime,
          error: err.message,
        });
      });
    });
  }

  public getInstallationGuide(): string {
    return 'Bash is installed by default on almost all Linux distributions.';
  }
}

// ==========================================
// 6. Zsh Adapter (macOS & Linux)
// ==========================================

export class ZshAdapter implements ShellAdapter {
  public readonly shellType: ShellType = 'zsh';
  public readonly name = 'Zsh';
  public readonly description = 'Z Shell (Default on macOS)';

  private cachedPath: string | null = null;

  public async getExecutablePath(): Promise<string | null> {
    if (this.cachedPath) return this.cachedPath;
    const paths = ['/bin/zsh', '/usr/bin/zsh'];
    for (const p of paths) {
      if (fs.existsSync(p)) {
        this.cachedPath = p;
        return p;
      }
    }
    return null;
  }

  public async isAvailable(): Promise<boolean> {
    const p = await this.getExecutablePath();
    return p !== null;
  }

  public async getVersion(): Promise<string | undefined> {
    const bin = (await this.getExecutablePath()) || 'zsh';
    return new Promise((resolve) => {
      exec(`"${bin}" --version`, (err, stdout) => {
        if (!err && stdout) {
          const match = stdout.match(/zsh\s+([0-9.]+)/i);
          resolve(match ? match[1] : '5.x');
        } else {
          resolve(undefined);
        }
      });
    });
  }

  public getCapabilities(): ShellCapability[] {
    return [
      {
        shellType: 'zsh',
        name: 'Change Directory',
        command: 'cd',
        description: 'Change directory',
        category: 'navigation',
        example: 'cd src',
      },
    ];
  }

  public getSpawnConfig(
    cwd: string,
    env?: Record<string, string>
  ): { executable: string; args: string[]; env: Record<string, string> } {
    const executable = this.cachedPath || '/bin/zsh';
    return {
      executable,
      args: ['--login'],
      env: { ...process.env, ...env, TERM: 'xterm-256color' } as Record<string, string>,
    };
  }

  public formatCommandLine(command: string): { executable: string; args: string[] } {
    return {
      executable: this.cachedPath || 'zsh',
      args: ['-c', command],
    };
  }

  public async executeCommand(
    command: string,
    cwd: string,
    env?: Record<string, string>,
    timeoutMs: number = 30000
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const executable = (await this.getExecutablePath()) || 'zsh';

    return new Promise((resolve) => {
      const child = spawn(executable, ['-c', command], {
        cwd,
        env: { ...process.env, ...env },
      });

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
      }, timeoutMs);

      child.stdout?.on('data', (d) => (stdout += d.toString()));
      child.stderr?.on('data', (d) => (stderr += d.toString()));

      child.on('close', (code) => {
        clearTimeout(timer);
        resolve({
          command,
          shellType: 'zsh',
          cwd,
          exitCode: timedOut ? 124 : (code ?? 0),
          stdout,
          stderr: timedOut ? `${stderr}\nTimed out` : stderr,
          durationMs: Date.now() - startTime,
          error: timedOut ? 'Command timed out' : undefined,
        });
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        resolve({
          command,
          shellType: 'zsh',
          cwd,
          exitCode: 1,
          stdout,
          stderr: err.message,
          durationMs: Date.now() - startTime,
          error: err.message,
        });
      });
    });
  }

  public getInstallationGuide(): string {
    return 'On macOS, Zsh is the default shell. On Linux: `sudo apt install zsh` or `sudo pacman -S zsh`.';
  }
}

// ==========================================
// 7. Shell Registry & Manager
// ==========================================

export class ShellRegistry {
  private adapters: Map<ShellType, ShellAdapter> = new Map();
  private defaultShellType: ShellType = 'bash';

  constructor() {
    this.registerAdapter(new RazzShellAdapter());
    this.registerAdapter(new PowerShellAdapter());
    this.registerAdapter(new BashAdapter());
    this.registerAdapter(new ZshAdapter());

    const osInfo = OSDetector.getOSInfo();
    this.defaultShellType = osInfo.defaultRecommendedShell;
  }

  public registerAdapter(adapter: ShellAdapter): void {
    this.adapters.set(adapter.shellType, adapter);
  }

  public getAdapter(shellType: ShellType): ShellAdapter {
    const adapter = this.adapters.get(shellType);
    if (!adapter) {
      // Fallback to bash or powershell
      const fallback =
        process.platform === 'win32'
          ? this.adapters.get('powershell')!
          : this.adapters.get('bash')!;
      return fallback;
    }
    return adapter;
  }

  public async getAvailableProfiles(): Promise<ShellProfile[]> {
    const osInfo = OSDetector.getOSInfo();
    const profiles: ShellProfile[] = [];

    for (const [type, adapter] of this.adapters.entries()) {
      const available = await adapter.isAvailable();
      const version = available ? await adapter.getVersion() : undefined;
      const execPath = (await adapter.getExecutablePath()) || '';

      profiles.push({
        id: type,
        name: adapter.name,
        shellType: type,
        executablePath: execPath,
        isDefault: type === this.defaultShellType,
        isAvailable: available,
        version,
        description: adapter.description,
      });
    }

    return profiles;
  }

  public getDefaultShellType(): ShellType {
    return this.defaultShellType;
  }

  public setDefaultShellType(shellType: ShellType): void {
    if (this.adapters.has(shellType)) {
      this.defaultShellType = shellType;
    }
  }
}

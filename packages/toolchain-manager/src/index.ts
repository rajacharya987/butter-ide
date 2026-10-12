import { exec } from 'node:child_process';
import {
  ToolchainItem,
  ToolchainInstallProgress,
  OSInfo,
} from '@ai-ide/shared';
import { OSDetector } from '@ai-ide/shell-adapters';

export class ToolchainManager {
  private items: Map<string, ToolchainItem> = new Map();
  private osInfo: OSInfo;

  constructor() {
    this.osInfo = OSDetector.getOSInfo();
    this.initCatalog();
  }

  private initCatalog() {
    const list: ToolchainItem[] = [
      // Core Languages
      {
        id: 'c',
        name: 'C (GCC)',
        category: 'language',
        description: 'GNU C Compiler for native systems programming',
        recommendedVersion: '14.x',
        isInstalled: false,
        isCompatible: true,
        homepageUrl: 'https://gcc.gnu.org',
        verificationCommand: 'gcc --version',
        packageNames: {
          arch: 'gcc',
          ubuntu: 'build-essential gcc',
          fedora: 'gcc',
          windows: 'MSYS2.MSYS2',
          macos: 'gcc',
        },
      },
      {
        id: 'cpp',
        name: 'C++ (G++)',
        category: 'language',
        description: 'GNU C++ Compiler with full modern C++20/C++23 support',
        recommendedVersion: '14.x',
        isInstalled: false,
        isCompatible: true,
        homepageUrl: 'https://gcc.gnu.org',
        verificationCommand: 'g++ --version',
        packageNames: {
          arch: 'gcc',
          ubuntu: 'g++',
          fedora: 'gcc-c++',
          windows: 'MSYS2.MSYS2',
          macos: 'gcc',
        },
      },
      {
        id: 'rust',
        name: 'Rust & Cargo',
        category: 'language',
        description: 'Fast, reliable, memory-safe language and package manager',
        recommendedVersion: '1.80+',
        isInstalled: false,
        isCompatible: true,
        homepageUrl: 'https://rust-lang.org',
        verificationCommand: 'rustc --version',
        packageNames: {
          arch: 'rust',
          ubuntu: 'rustc cargo',
          fedora: 'rust cargo',
          windows: 'Rustlang.Rustup',
          macos: 'rust',
        },
      },
      {
        id: 'go',
        name: 'Go (Golang)',
        category: 'language',
        description: 'Open source programming language for simple, fast, reliable software',
        recommendedVersion: '1.23+',
        isInstalled: false,
        isCompatible: true,
        homepageUrl: 'https://go.dev',
        verificationCommand: 'go version',
        packageNames: {
          arch: 'go',
          ubuntu: 'golang',
          fedora: 'golang',
          windows: 'GoLang.Go',
          macos: 'go',
        },
      },
      {
        id: 'python',
        name: 'Python 3',
        category: 'language',
        description: 'Versatile dynamic programming language and package ecosystem',
        recommendedVersion: '3.12+',
        isInstalled: false,
        isCompatible: true,
        homepageUrl: 'https://python.org',
        verificationCommand: 'python3 --version',
        packageNames: {
          arch: 'python python-pip',
          ubuntu: 'python3 python3-pip python3-venv',
          fedora: 'python3 python3-pip',
          windows: 'Python.Python.3.12',
          macos: 'python3',
        },
      },
      {
        id: 'nodejs',
        name: 'Node.js',
        category: 'runtime',
        description: 'JavaScript runtime built on Chrome V8 engine',
        recommendedVersion: '22.x LTS',
        isInstalled: false,
        isCompatible: true,
        homepageUrl: 'https://nodejs.org',
        verificationCommand: 'node -v',
        packageNames: {
          arch: 'nodejs npm',
          ubuntu: 'nodejs npm',
          fedora: 'nodejs npm',
          windows: 'OpenJS.NodeJS',
          macos: 'node',
        },
      },
      {
        id: 'typescript',
        name: 'TypeScript Compiler',
        category: 'language',
        description: 'Typed superset of JavaScript that compiles to plain JavaScript',
        recommendedVersion: '5.x',
        isInstalled: false,
        isCompatible: true,
        homepageUrl: 'https://typescriptlang.org',
        verificationCommand: 'npx tsc --version',
        packageNames: {
          arch: 'typescript',
          ubuntu: 'node-typescript',
          fedora: 'typescript',
          windows: 'OpenJS.NodeJS',
          macos: 'typescript',
        },
      },
      {
        id: 'csharp',
        name: '.NET SDK (C#)',
        category: 'language',
        description: 'Cross-platform SDK for building cloud, desktop, and console apps',
        recommendedVersion: '9.0',
        isInstalled: false,
        isCompatible: true,
        homepageUrl: 'https://dotnet.microsoft.com',
        verificationCommand: 'dotnet --version',
        packageNames: {
          arch: 'dotnet-sdk',
          ubuntu: 'dotnet-sdk-8.0',
          fedora: 'dotnet-sdk-8.0',
          windows: 'Microsoft.DotNet.SDK.8',
          macos: 'dotnet-sdk',
        },
      },
      {
        id: 'java',
        name: 'Java (OpenJDK)',
        category: 'language',
        description: 'Open-source implementation of the Java Platform, Standard Edition',
        recommendedVersion: '21 LTS',
        isInstalled: false,
        isCompatible: true,
        homepageUrl: 'https://openjdk.org',
        verificationCommand: 'javac -version',
        packageNames: {
          arch: 'jdk-openjdk',
          ubuntu: 'default-jdk',
          fedora: 'java-latest-openjdk-devel',
          windows: 'Oracle.JDK.21',
          macos: 'openjdk',
        },
      },
      {
        id: 'lua',
        name: 'Lua',
        category: 'language',
        description: 'Lightweight, high-level, multi-paradigm programming language',
        recommendedVersion: '5.4',
        isInstalled: false,
        isCompatible: true,
        homepageUrl: 'https://lua.org',
        verificationCommand: 'lua -v',
        packageNames: {
          arch: 'lua',
          ubuntu: 'lua5.4',
          fedora: 'lua',
          windows: 'Lua.Lua',
          macos: 'lua',
        },
      },

      // Native Build Tools & Debuggers
      {
        id: 'cmake',
        name: 'CMake',
        category: 'build_tool',
        description: 'Cross-platform open-source build system generator',
        recommendedVersion: '3.28+',
        isInstalled: false,
        isCompatible: true,
        homepageUrl: 'https://cmake.org',
        verificationCommand: 'cmake --version',
        packageNames: {
          arch: 'cmake',
          ubuntu: 'cmake',
          fedora: 'cmake',
          windows: 'Kitware.CMake',
          macos: 'cmake',
        },
      },
      {
        id: 'ninja',
        name: 'Ninja',
        category: 'build_tool',
        description: 'Small build system with a focus on speed',
        recommendedVersion: '1.12+',
        isInstalled: false,
        isCompatible: true,
        homepageUrl: 'https://ninja-build.org',
        verificationCommand: 'ninja --version',
        packageNames: {
          arch: 'ninja',
          ubuntu: 'ninja-build',
          fedora: 'ninja-build',
          windows: 'Ninja-build.Ninja',
          macos: 'ninja',
        },
      },
      {
        id: 'make',
        name: 'GNU Make',
        category: 'build_tool',
        description: 'Standard Unix tool for controlling generation of executables',
        recommendedVersion: '4.4+',
        isInstalled: false,
        isCompatible: true,
        homepageUrl: 'https://gnu.org/software/make',
        verificationCommand: 'make --version',
        packageNames: {
          arch: 'make',
          ubuntu: 'make',
          fedora: 'make',
          windows: 'GnuWin32.Make',
          macos: 'make',
        },
      },
      {
        id: 'clang',
        name: 'Clang / LLVM',
        category: 'build_tool',
        description: 'C/C++ compiler front-end for LLVM',
        recommendedVersion: '18.x',
        isInstalled: false,
        isCompatible: true,
        homepageUrl: 'https://clang.llvm.org',
        verificationCommand: 'clang --version',
        packageNames: {
          arch: 'clang llvm',
          ubuntu: 'clang llvm',
          fedora: 'clang llvm',
          windows: 'LLVM.LLVM',
          macos: 'llvm',
        },
      },
      {
        id: 'gdb',
        name: 'GDB',
        category: 'debugger',
        description: 'GNU Project Debugger for native C/C++ applications',
        recommendedVersion: '14.x',
        isInstalled: false,
        isCompatible: !this.osInfo.isWindows,
        homepageUrl: 'https://sourceware.org/gdb',
        verificationCommand: 'gdb --version',
        packageNames: {
          arch: 'gdb',
          ubuntu: 'gdb',
          fedora: 'gdb',
          windows: 'MSYS2.MSYS2',
          macos: 'gdb',
        },
      },

      // Modern Web Runtimes & Package Managers
      {
        id: 'pnpm',
        name: 'pnpm',
        category: 'runtime',
        description: 'Fast, disk space efficient package manager',
        recommendedVersion: '9.x',
        isInstalled: false,
        isCompatible: true,
        homepageUrl: 'https://pnpm.io',
        verificationCommand: 'pnpm -v',
        packageNames: {
          arch: 'pnpm',
          ubuntu: 'pnpm',
          fedora: 'pnpm',
          windows: 'pnpm.pnpm',
          macos: 'pnpm',
        },
      },
      {
        id: 'bun',
        name: 'Bun',
        category: 'runtime',
        description: 'Incredibly fast all-in-one JavaScript runtime & bundler',
        recommendedVersion: '1.1+',
        isInstalled: false,
        isCompatible: true,
        homepageUrl: 'https://bun.sh',
        verificationCommand: 'bun --version',
        packageNames: {
          arch: 'bun-bin',
          ubuntu: 'bun',
          fedora: 'bun',
          windows: 'Oven-sh.Bun',
          macos: 'oven-sh/bun/bun',
        },
      },
      {
        id: 'deno',
        name: 'Deno',
        category: 'runtime',
        description: 'Next-generation JavaScript and TypeScript runtime',
        recommendedVersion: '2.x',
        isInstalled: false,
        isCompatible: true,
        homepageUrl: 'https://deno.com',
        verificationCommand: 'deno --version',
        packageNames: {
          arch: 'deno',
          ubuntu: 'deno',
          fedora: 'deno',
          windows: 'DenoLand.Deno',
          macos: 'deno',
        },
      },
      {
        id: 'git',
        name: 'Git',
        category: 'vcs',
        description: 'Distributed version control system',
        recommendedVersion: '2.40+',
        isInstalled: false,
        isCompatible: true,
        homepageUrl: 'https://git-scm.com',
        verificationCommand: 'git --version',
        packageNames: {
          arch: 'git',
          ubuntu: 'git',
          fedora: 'git',
          windows: 'Git.Git',
          macos: 'git',
        },
      },
    ];

    for (const item of list) {
      this.items.set(item.id, item);
    }
  }

  public async getCatalog(): Promise<ToolchainItem[]> {
    const results: ToolchainItem[] = [];
    for (const item of this.items.values()) {
      const ver = await this.detectItem(item);
      results.push({
        ...item,
        isInstalled: ver !== undefined,
        detectedVersion: ver,
      });
    }
    return results;
  }

  public async verifyItem(id: string): Promise<{ isInstalled: boolean; version?: string }> {
    const item = this.items.get(id);
    if (!item) return { isInstalled: false };
    const version = await this.detectItem(item);
    return {
      isInstalled: version !== undefined,
      version,
    };
  }

  private detectItem(item: ToolchainItem): Promise<string | undefined> {
    return new Promise((resolve) => {
      exec(item.verificationCommand, { timeout: 3000 }, (error, stdout) => {
        if (!error && stdout) {
          const match = stdout.match(/([0-9]+\.[0-9]+(?:\.[0-9]+)?)/);
          resolve(match ? match[1] : 'Installed');
        } else {
          resolve(undefined);
        }
      });
    });
  }

  public getInstallCommand(id: string): string | null {
    const item = this.items.get(id);
    if (!item) return null;

    if (this.osInfo.isArch) {
      const pkg = item.packageNames.arch;
      return pkg ? `sudo pacman -S --needed --noconfirm ${pkg}` : null;
    } else if (this.osInfo.isUbuntuOrDebian) {
      const pkg = item.packageNames.ubuntu;
      return pkg ? `sudo apt-get update && sudo apt-get install -y ${pkg}` : null;
    } else if (this.osInfo.osType === 'fedora') {
      const pkg = item.packageNames.fedora;
      return pkg ? `sudo dnf install -y ${pkg}` : null;
    } else if (this.osInfo.isWindows) {
      const id = item.packageNames.windows;
      return id ? `winget install --id ${id} -e --silent` : null;
    } else if (this.osInfo.isMacOS) {
      const pkg = item.packageNames.macos;
      return pkg ? `brew install ${pkg}` : null;
    }

    return null;
  }

  public async install(
    id: string,
    onProgress: (p: ToolchainInstallProgress) => void
  ): Promise<boolean> {
    const item = this.items.get(id);
    if (!item) {
      onProgress({
        toolchainId: id,
        status: 'failed',
        stepMessage: `Toolchain '${id}' not found`,
        percent: 0,
        logs: [],
        error: 'Unknown toolchain',
      });
      return false;
    }

    const command = this.getInstallCommand(id);
    if (!command) {
      onProgress({
        toolchainId: id,
        status: 'failed',
        stepMessage: `No automated install recipe for '${item.name}' on ${this.osInfo.distName}`,
        percent: 0,
        logs: [],
        error: 'Unsupported platform recipe',
      });
      return false;
    }

    onProgress({
      toolchainId: id,
      status: 'installing',
      stepMessage: `Executing package recipe: ${command}`,
      percent: 20,
      logs: [`Preparing recipe for ${item.name}...`, `Running: ${command}`],
    });

    const installLogs: string[] = [];

    const exitCode = await new Promise<number>((resolve) => {
      const child = exec(command, { timeout: 180000 });
      child.stdout?.on('data', (d) => {
        installLogs.push(d.toString());
        onProgress({
          toolchainId: id,
          status: 'installing',
          stepMessage: `Installing ${item.name}...`,
          percent: 50,
          logs: [...installLogs],
        });
      });
      child.stderr?.on('data', (d) => {
        installLogs.push(d.toString());
      });
      child.on('close', (code) => resolve(code ?? 1));
      child.on('error', () => resolve(1));
    });

    onProgress({
      toolchainId: id,
      status: 'verifying',
      stepMessage: `Verifying installation of ${item.name}...`,
      percent: 85,
      logs: [...installLogs, `Verification command: ${item.verificationCommand}`],
    });

    const verifyResult = await this.verifyItem(id);
    if (verifyResult.isInstalled) {
      onProgress({
        toolchainId: id,
        status: 'installed',
        stepMessage: `Successfully verified ${item.name} (${verifyResult.version})`,
        percent: 100,
        logs: [...installLogs, `Verified version: ${verifyResult.version}`],
      });
      return true;
    } else {
      onProgress({
        toolchainId: id,
        status: 'failed',
        stepMessage: `Installation verification failed for ${item.name}`,
        percent: 100,
        logs: [...installLogs, `Exit code was ${exitCode}, but verification command failed.`],
        error: 'Post-install verification failed',
      });
      return false;
    }
  }
}

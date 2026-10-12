import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as pty from 'node-pty';

import {
  ShellType,
  TemplateType,
  AIProviderId,
  AIProviderConfig,
  ChatMessage,
  ToolDefinition,
  AutonomyLevel,
  PermissionDecision,
  ProjectTemplate,
} from '@ai-ide/shared';

import { ShellRegistry, OSDetector, RazzShellAdapter } from '@ai-ide/shell-adapters';
import { AIProviderRegistry } from '@ai-ide/ai-providers';
import { PermissionBroker, CredentialStore } from '@ai-ide/security';
import { WorkspaceService } from '@ai-ide/workspace';
import { ToolchainManager } from '@ai-ide/toolchain-manager';
import { GitService } from '@ai-ide/git-integration';
import { AgentOrchestrator, PersistentMemory } from '@ai-ide/agent-core';

// Global services
let mainWindow: BrowserWindow | null = null;
let workspaceRoot = process.cwd();

const shellRegistry = new ShellRegistry();
const aiRegistry = new AIProviderRegistry();
const permissionBroker = new PermissionBroker('supervised');
const credentialStore = new CredentialStore();
const toolchainManager = new ToolchainManager();
const memory = new PersistentMemory();

let workspaceService = new WorkspaceService(workspaceRoot);
let gitService = new GitService(workspaceRoot);
let agentOrchestrator: AgentOrchestrator | null = null;

// Terminal PTY instances
const ptySessions = new Map<string, pty.IPty>();

function initAgentOrchestrator() {
  agentOrchestrator = new AgentOrchestrator(
    workspaceService,
    shellRegistry,
    aiRegistry,
    permissionBroker,
    toolchainManager,
    gitService,
    memory
  );

  agentOrchestrator.onEvent((event) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('agent:event', event);
    }
  });
}

function createWindow() {
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 700,
    frame: true,
    backgroundColor: '#0d1117',
    title: 'AI-First Desktop IDE with RazzShell',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    const indexPath = path.join(__dirname, '../renderer/index.html');
    if (fs.existsSync(indexPath)) {
      mainWindow.loadFile(indexPath);
    } else {
      mainWindow.loadURL('http://localhost:5173');
    }
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    // Cleanup PTY sessions
    for (const [id, session] of ptySessions.entries()) {
      try {
        session.kill();
      } catch {}
    }
    ptySessions.clear();
  });
}

// ==========================================
// IPC Handler Registration
// ==========================================

function registerIpcHandlers() {
  // --- System & Shell ---
  ipcMain.handle('os:getInfo', async () => {
    return OSDetector.getOSInfo();
  });

  ipcMain.handle('shell:getProfiles', async () => {
    return shellRegistry.getAvailableProfiles();
  });

  ipcMain.handle('shell:getDefault', async () => {
    const defaultType = shellRegistry.getDefaultShellType();
    const profiles = await shellRegistry.getAvailableProfiles();
    return profiles.find((p) => p.shellType === defaultType) || profiles[0];
  });

  ipcMain.handle('shell:setDefault', async (_, profileId: ShellType) => {
    shellRegistry.setDefaultShellType(profileId);
  });

  ipcMain.handle('shell:installRazzShell', async () => {
    const razz = new RazzShellAdapter();
    const osInfo = OSDetector.getOSInfo();

    // Run build and install from scratch repo into ~/.local/bin/razzshell
    try {
      const localBinDir = path.join(process.env.HOME || '/home/dedsec', '.local', 'bin');
      if (!fs.existsSync(localBinDir)) {
        fs.mkdirSync(localBinDir, { recursive: true });
      }

      const scratchDir = '/home/dedsec/.gemini/antigravity-cli/brain/11824ef6-a896-40b7-ba82-399176fd9dd5/scratch/razzshell';
      const destBinary = path.join(localBinDir, 'razzshell');

      if (fs.existsSync(path.join(scratchDir, 'razzshell'))) {
        fs.copyFileSync(path.join(scratchDir, 'razzshell'), destBinary);
        fs.chmodSync(destBinary, 0o755);
        return {
          success: true,
          output: `Successfully installed RazzShell v2.0.0 to ${destBinary}`,
        };
      }

      return {
        success: false,
        output: '',
        error: 'RazzShell build artifact not found',
      };
    } catch (err: any) {
      return { success: false, output: '', error: err.message };
    }
  });

  // --- Workspace & Files ---
  ipcMain.handle('workspace:openDialog', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
    });

    if (!result.canceled && result.filePaths.length > 0) {
      const chosen = result.filePaths[0];
      workspaceRoot = chosen;
      workspaceService.setRoot(chosen);
      gitService = new GitService(chosen);
      initAgentOrchestrator();
      return chosen;
    }
    return null;
  });

  ipcMain.handle('workspace:listFiles', async (_, dirPath?: string) => {
    return workspaceService.listFiles(dirPath);
  });

  ipcMain.handle('workspace:readFile', async (_, filePath: string) => {
    return workspaceService.readFile(filePath);
  });

  ipcMain.handle('workspace:writeFile', async (_, filePath: string, content: string) => {
    workspaceService.writeFile(filePath, content);
  });

  ipcMain.handle('workspace:createFile', async (_, filePath: string, initialContent?: string) => {
    workspaceService.createFile(filePath, initialContent || '');
  });

  ipcMain.handle('workspace:createDirectory', async (_, dirPath: string) => {
    workspaceService.createDirectory(dirPath);
  });

  ipcMain.handle('workspace:delete', async (_, targetPath: string) => {
    workspaceService.deletePath(targetPath);
  });

  ipcMain.handle('workspace:search', async (_, query: string, options?: any) => {
    return workspaceService.search(query, options);
  });

  // --- Terminal & Execution ---
  ipcMain.handle('terminal:create', async (_, options?: { shellType?: ShellType; cwd?: string }) => {
    const id = `term_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const shellType = options?.shellType || shellRegistry.getDefaultShellType();
    const adapter = shellRegistry.getAdapter(shellType);
    const cwd = options?.cwd || workspaceRoot;

    const spawnConfig = adapter.getSpawnConfig(cwd);

    const ptyProcess = pty.spawn(spawnConfig.executable, spawnConfig.args, {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd,
      env: spawnConfig.env as any,
    });

    ptySessions.set(id, ptyProcess);

    ptyProcess.onData((data) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('terminal:data', { terminalId: id, data });
      }
    });

    ptyProcess.onExit(({ exitCode }) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('terminal:exit', { terminalId: id, exitCode });
      }
      ptySessions.delete(id);
    });

    return {
      id,
      title: adapter.name,
      shellType,
      cwd,
      pid: ptyProcess.pid,
      active: true,
    };
  });

  ipcMain.handle('terminal:write', async (_, terminalId: string, data: string) => {
    const session = ptySessions.get(terminalId);
    if (session) {
      session.write(data);
    }
  });

  ipcMain.handle('terminal:resize', async (_, terminalId: string, cols: number, rows: number) => {
    const session = ptySessions.get(terminalId);
    if (session) {
      try {
        session.resize(cols, rows);
      } catch {}
    }
  });

  ipcMain.handle('terminal:close', async (_, terminalId: string) => {
    const session = ptySessions.get(terminalId);
    if (session) {
      try {
        session.kill();
      } catch {}
      ptySessions.delete(terminalId);
    }
  });

  ipcMain.handle(
    'terminal:execute',
    async (_, command: string, options?: { shellType?: ShellType; cwd?: string; timeoutMs?: number }) => {
      const shellType = options?.shellType || shellRegistry.getDefaultShellType();
      const adapter = shellRegistry.getAdapter(shellType);
      const cwd = options?.cwd || workspaceRoot;
      return adapter.executeCommand(command, cwd, undefined, options?.timeoutMs);
    }
  );

  // --- AI Providers ---
  ipcMain.handle('ai:getConfigs', async () => {
    return aiRegistry.getAllConfigs();
  });

  ipcMain.handle('ai:saveConfig', async (_, config: AIProviderConfig) => {
    if (config.apiKey) {
      credentialStore.saveSecret(`ai_key_${config.id}`, config.apiKey);
    }
    aiRegistry.saveConfig(config);
  });

  ipcMain.handle('ai:testConnection', async (_, providerId: AIProviderId) => {
    return aiRegistry.testConnection(providerId);
  });

  ipcMain.handle('ai:chat', async (_, params: any) => {
    return aiRegistry.chat(params);
  });

  ipcMain.handle('ai:streamChat', async (_, params: any) => {
    const { streamId, ...chatParams } = params;
    const provider = aiRegistry.getProvider(chatParams.providerId);
    const config = aiRegistry.getConfig(chatParams.providerId);

    await provider.streamChat({
      config,
      messages: chatParams.messages,
      tools: chatParams.tools,
      temperature: chatParams.temperature,
      onChunk: (chunk) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('ai:streamChunk', { streamId, chunk });
        }
      },
    });
  });

  // --- Agent Core ---
  ipcMain.handle('agent:startTask', async (_, params: { goal: string; autonomyLevel: AutonomyLevel }) => {
    if (!agentOrchestrator) initAgentOrchestrator();
    return agentOrchestrator!.startTask(params.goal, params.autonomyLevel);
  });

  ipcMain.handle('agent:cancelTask', async (_, taskId: string) => {
    if (agentOrchestrator) {
      agentOrchestrator.cancelTask(taskId);
    }
  });

  ipcMain.handle('agent:respondPermission', async (_, decision: PermissionDecision) => {
    // If pending permission promise is held, resolve it
  });

  // --- Toolchains ---
  ipcMain.handle('toolchain:getCatalog', async () => {
    return toolchainManager.getCatalog();
  });

  ipcMain.handle('toolchain:verify', async (_, toolchainId: string) => {
    return toolchainManager.verifyItem(toolchainId);
  });

  ipcMain.handle('toolchain:install', async (_, toolchainId: string) => {
    return toolchainManager.install(toolchainId, (progress) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('toolchain:progress', progress);
      }
    });
  });

  // --- Git ---
  ipcMain.handle('git:getStatus', async (_, cwd?: string) => {
    return gitService.getStatus(cwd);
  });

  ipcMain.handle('git:getDiff', async (_, filePath?: string, staged?: boolean) => {
    return gitService.getDiff(filePath, staged);
  });

  ipcMain.handle('git:stage', async (_, filePaths: string[]) => {
    return gitService.stage(filePaths);
  });

  ipcMain.handle('git:unstage', async (_, filePaths: string[]) => {
    return gitService.unstage(filePaths);
  });

  ipcMain.handle('git:commit', async (_, message: string) => {
    return gitService.commit(message);
  });

  ipcMain.handle('git:createBranch', async (_, branchName: string) => {
    return gitService.createBranch(branchName);
  });

  ipcMain.handle('git:checkout', async (_, branchOrCommit: string) => {
    return gitService.checkout(branchOrCommit);
  });

  ipcMain.handle('git:getLog', async (_, limit?: number) => {
    return gitService.getLog(limit);
  });

  // --- Templates & Wizards ---
  ipcMain.handle('template:getTemplates', async (): Promise<ProjectTemplate[]> => {
    return [
      {
        id: 'cpp-cmake',
        name: 'C++ Console Project (CMake)',
        language: 'C++',
        description: 'Modern C++20 console application with CMake build configuration',
        defaultBuildCmd: 'cmake -B build && cmake --build build',
        defaultRunCmd: './build/app',
        defaultTestCmd: 'ctest --test-dir build',
        requiredToolchains: ['c', 'cpp', 'cmake'],
      },
      {
        id: 'rust-app',
        name: 'Rust Console Application (Cargo)',
        language: 'Rust',
        description: 'Fast and memory-safe Rust binary with Cargo packaging',
        defaultBuildCmd: 'cargo build',
        defaultRunCmd: 'cargo run',
        defaultTestCmd: 'cargo test',
        requiredToolchains: ['rust'],
      },
      {
        id: 'go-app',
        name: 'Go Console Application',
        language: 'Go',
        description: 'Simple and fast Go CLI application with standard modules',
        defaultBuildCmd: 'go build -o app main.go',
        defaultRunCmd: './app',
        defaultTestCmd: 'go test ./...',
        requiredToolchains: ['go'],
      },
      {
        id: 'python-app',
        name: 'Python Application',
        language: 'Python',
        description: 'Standard Python 3 script with requirements.txt',
        defaultBuildCmd: 'python3 -m py_compile main.py',
        defaultRunCmd: 'python3 main.py',
        defaultTestCmd: 'pytest',
        requiredToolchains: ['python'],
      },
      {
        id: 'node-ts-app',
        name: 'Node.js & TypeScript Project',
        language: 'TypeScript',
        description: 'Node.js application with TypeScript compiler configuration',
        defaultBuildCmd: 'npm run build',
        defaultRunCmd: 'npm start',
        defaultTestCmd: 'npm test',
        requiredToolchains: ['nodejs', 'typescript'],
      },
    ];
  });

  ipcMain.handle(
    'template:createProject',
    async (_, params: { templateId: TemplateType; targetDir: string; projectName: string }) => {
      const templateRoot = path.join(app.getAppPath(), 'templates', params.templateId);
      const target = path.join(params.targetDir, params.projectName);

      if (!fs.existsSync(target)) {
        fs.mkdirSync(target, { recursive: true });
      }

      if (fs.existsSync(templateRoot)) {
        // Recursive copy template files
        const copyRecursive = (src: string, dest: string) => {
          const entries = fs.readdirSync(src, { withFileTypes: true });
          for (const entry of entries) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);
            if (entry.isDirectory()) {
              if (!fs.existsSync(destPath)) fs.mkdirSync(destPath, { recursive: true });
              copyRecursive(srcPath, destPath);
            } else {
              fs.copyFileSync(srcPath, destPath);
            }
          }
        };
        copyRecursive(templateRoot, target);
      }

      // Update workspace root to new project
      workspaceRoot = target;
      workspaceService.setRoot(target);
      gitService = new GitService(target);
      initAgentOrchestrator();

      return { projectPath: target };
    }
  );

  // --- Window Controls ---
  ipcMain.handle('window:minimize', async () => mainWindow?.minimize());
  ipcMain.handle('window:maximize', async () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
  });
  ipcMain.handle('window:close', async () => mainWindow?.close());
}

app.whenReady().then(() => {
  initAgentOrchestrator();
  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

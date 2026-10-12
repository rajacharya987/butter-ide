"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("node:path"));
const fs = __importStar(require("node:fs"));
const pty = __importStar(require("node-pty"));
const shell_adapters_1 = require("@ai-ide/shell-adapters");
const ai_providers_1 = require("@ai-ide/ai-providers");
const security_1 = require("@ai-ide/security");
const workspace_1 = require("@ai-ide/workspace");
const toolchain_manager_1 = require("@ai-ide/toolchain-manager");
const git_integration_1 = require("@ai-ide/git-integration");
const agent_core_1 = require("@ai-ide/agent-core");
// Global services
let mainWindow = null;
let workspaceRoot = process.cwd();
const shellRegistry = new shell_adapters_1.ShellRegistry();
const aiRegistry = new ai_providers_1.AIProviderRegistry();
const permissionBroker = new security_1.PermissionBroker('supervised');
const credentialStore = new security_1.CredentialStore();
const toolchainManager = new toolchain_manager_1.ToolchainManager();
const memory = new agent_core_1.PersistentMemory();
let workspaceService = new workspace_1.WorkspaceService(workspaceRoot);
let gitService = new git_integration_1.GitService(workspaceRoot);
let agentOrchestrator = null;
// Terminal PTY instances
const ptySessions = new Map();
function initAgentOrchestrator() {
    agentOrchestrator = new agent_core_1.AgentOrchestrator(workspaceService, shellRegistry, aiRegistry, permissionBroker, toolchainManager, gitService, memory);
    agentOrchestrator.onEvent((event) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('agent:event', event);
        }
    });
}
function createWindow() {
    const isDev = process.env.NODE_ENV === 'development' || !electron_1.app.isPackaged;
    mainWindow = new electron_1.BrowserWindow({
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
    }
    else {
        const indexPath = path.join(__dirname, '../renderer/index.html');
        if (fs.existsSync(indexPath)) {
            mainWindow.loadFile(indexPath);
        }
        else {
            mainWindow.loadURL('http://localhost:5173');
        }
    }
    mainWindow.on('closed', () => {
        mainWindow = null;
        // Cleanup PTY sessions
        for (const [id, session] of ptySessions.entries()) {
            try {
                session.kill();
            }
            catch { }
        }
        ptySessions.clear();
    });
}
// ==========================================
// IPC Handler Registration
// ==========================================
function registerIpcHandlers() {
    // --- System & Shell ---
    electron_1.ipcMain.handle('os:getInfo', async () => {
        return shell_adapters_1.OSDetector.getOSInfo();
    });
    electron_1.ipcMain.handle('shell:getProfiles', async () => {
        return shellRegistry.getAvailableProfiles();
    });
    electron_1.ipcMain.handle('shell:getDefault', async () => {
        const defaultType = shellRegistry.getDefaultShellType();
        const profiles = await shellRegistry.getAvailableProfiles();
        return profiles.find((p) => p.shellType === defaultType) || profiles[0];
    });
    electron_1.ipcMain.handle('shell:setDefault', async (_, profileId) => {
        shellRegistry.setDefaultShellType(profileId);
    });
    electron_1.ipcMain.handle('shell:installRazzShell', async () => {
        const razz = new shell_adapters_1.RazzShellAdapter();
        const osInfo = shell_adapters_1.OSDetector.getOSInfo();
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
        }
        catch (err) {
            return { success: false, output: '', error: err.message };
        }
    });
    // --- Workspace & Files ---
    electron_1.ipcMain.handle('workspace:openDialog', async () => {
        if (!mainWindow)
            return null;
        const result = await electron_1.dialog.showOpenDialog(mainWindow, {
            properties: ['openDirectory'],
        });
        if (!result.canceled && result.filePaths.length > 0) {
            const chosen = result.filePaths[0];
            workspaceRoot = chosen;
            workspaceService.setRoot(chosen);
            gitService = new git_integration_1.GitService(chosen);
            initAgentOrchestrator();
            return chosen;
        }
        return null;
    });
    electron_1.ipcMain.handle('workspace:listFiles', async (_, dirPath) => {
        return workspaceService.listFiles(dirPath);
    });
    electron_1.ipcMain.handle('workspace:readFile', async (_, filePath) => {
        return workspaceService.readFile(filePath);
    });
    electron_1.ipcMain.handle('workspace:writeFile', async (_, filePath, content) => {
        workspaceService.writeFile(filePath, content);
    });
    electron_1.ipcMain.handle('workspace:createFile', async (_, filePath, initialContent) => {
        workspaceService.createFile(filePath, initialContent || '');
    });
    electron_1.ipcMain.handle('workspace:createDirectory', async (_, dirPath) => {
        workspaceService.createDirectory(dirPath);
    });
    electron_1.ipcMain.handle('workspace:delete', async (_, targetPath) => {
        workspaceService.deletePath(targetPath);
    });
    electron_1.ipcMain.handle('workspace:search', async (_, query, options) => {
        return workspaceService.search(query, options);
    });
    // --- Terminal & Execution ---
    electron_1.ipcMain.handle('terminal:create', async (_, options) => {
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
            env: spawnConfig.env,
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
    electron_1.ipcMain.handle('terminal:write', async (_, terminalId, data) => {
        const session = ptySessions.get(terminalId);
        if (session) {
            session.write(data);
        }
    });
    electron_1.ipcMain.handle('terminal:resize', async (_, terminalId, cols, rows) => {
        const session = ptySessions.get(terminalId);
        if (session) {
            try {
                session.resize(cols, rows);
            }
            catch { }
        }
    });
    electron_1.ipcMain.handle('terminal:close', async (_, terminalId) => {
        const session = ptySessions.get(terminalId);
        if (session) {
            try {
                session.kill();
            }
            catch { }
            ptySessions.delete(terminalId);
        }
    });
    electron_1.ipcMain.handle('terminal:execute', async (_, command, options) => {
        const shellType = options?.shellType || shellRegistry.getDefaultShellType();
        const adapter = shellRegistry.getAdapter(shellType);
        const cwd = options?.cwd || workspaceRoot;
        return adapter.executeCommand(command, cwd, undefined, options?.timeoutMs);
    });
    // --- AI Providers ---
    electron_1.ipcMain.handle('ai:getConfigs', async () => {
        return aiRegistry.getAllConfigs();
    });
    electron_1.ipcMain.handle('ai:saveConfig', async (_, config) => {
        if (config.apiKey) {
            credentialStore.saveSecret(`ai_key_${config.id}`, config.apiKey);
        }
        aiRegistry.saveConfig(config);
    });
    electron_1.ipcMain.handle('ai:testConnection', async (_, providerId) => {
        return aiRegistry.testConnection(providerId);
    });
    electron_1.ipcMain.handle('ai:chat', async (_, params) => {
        return aiRegistry.chat(params);
    });
    electron_1.ipcMain.handle('ai:streamChat', async (_, params) => {
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
    electron_1.ipcMain.handle('agent:startTask', async (_, params) => {
        if (!agentOrchestrator)
            initAgentOrchestrator();
        return agentOrchestrator.startTask(params.goal, params.autonomyLevel);
    });
    electron_1.ipcMain.handle('agent:cancelTask', async (_, taskId) => {
        if (agentOrchestrator) {
            agentOrchestrator.cancelTask(taskId);
        }
    });
    electron_1.ipcMain.handle('agent:respondPermission', async (_, decision) => {
        // If pending permission promise is held, resolve it
    });
    // --- Toolchains ---
    electron_1.ipcMain.handle('toolchain:getCatalog', async () => {
        return toolchainManager.getCatalog();
    });
    electron_1.ipcMain.handle('toolchain:verify', async (_, toolchainId) => {
        return toolchainManager.verifyItem(toolchainId);
    });
    electron_1.ipcMain.handle('toolchain:install', async (_, toolchainId) => {
        return toolchainManager.install(toolchainId, (progress) => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('toolchain:progress', progress);
            }
        });
    });
    // --- Git ---
    electron_1.ipcMain.handle('git:getStatus', async (_, cwd) => {
        return gitService.getStatus(cwd);
    });
    electron_1.ipcMain.handle('git:getDiff', async (_, filePath, staged) => {
        return gitService.getDiff(filePath, staged);
    });
    electron_1.ipcMain.handle('git:stage', async (_, filePaths) => {
        return gitService.stage(filePaths);
    });
    electron_1.ipcMain.handle('git:unstage', async (_, filePaths) => {
        return gitService.unstage(filePaths);
    });
    electron_1.ipcMain.handle('git:commit', async (_, message) => {
        return gitService.commit(message);
    });
    electron_1.ipcMain.handle('git:createBranch', async (_, branchName) => {
        return gitService.createBranch(branchName);
    });
    electron_1.ipcMain.handle('git:checkout', async (_, branchOrCommit) => {
        return gitService.checkout(branchOrCommit);
    });
    electron_1.ipcMain.handle('git:getLog', async (_, limit) => {
        return gitService.getLog(limit);
    });
    // --- Templates & Wizards ---
    electron_1.ipcMain.handle('template:getTemplates', async () => {
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
    electron_1.ipcMain.handle('template:createProject', async (_, params) => {
        const templateRoot = path.join(electron_1.app.getAppPath(), 'templates', params.templateId);
        const target = path.join(params.targetDir, params.projectName);
        if (!fs.existsSync(target)) {
            fs.mkdirSync(target, { recursive: true });
        }
        if (fs.existsSync(templateRoot)) {
            // Recursive copy template files
            const copyRecursive = (src, dest) => {
                const entries = fs.readdirSync(src, { withFileTypes: true });
                for (const entry of entries) {
                    const srcPath = path.join(src, entry.name);
                    const destPath = path.join(dest, entry.name);
                    if (entry.isDirectory()) {
                        if (!fs.existsSync(destPath))
                            fs.mkdirSync(destPath, { recursive: true });
                        copyRecursive(srcPath, destPath);
                    }
                    else {
                        fs.copyFileSync(srcPath, destPath);
                    }
                }
            };
            copyRecursive(templateRoot, target);
        }
        // Update workspace root to new project
        workspaceRoot = target;
        workspaceService.setRoot(target);
        gitService = new git_integration_1.GitService(target);
        initAgentOrchestrator();
        return { projectPath: target };
    });
    // --- Window Controls ---
    electron_1.ipcMain.handle('window:minimize', async () => mainWindow?.minimize());
    electron_1.ipcMain.handle('window:maximize', async () => {
        if (mainWindow?.isMaximized())
            mainWindow.unmaximize();
        else
            mainWindow?.maximize();
    });
    electron_1.ipcMain.handle('window:close', async () => mainWindow?.close());
}
electron_1.app.whenReady().then(() => {
    initAgentOrchestrator();
    registerIpcHandlers();
    createWindow();
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0)
            createWindow();
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
//# sourceMappingURL=index.js.map
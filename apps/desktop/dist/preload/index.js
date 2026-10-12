"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const api = {
    // System & Shell
    getOSInfo: () => electron_1.ipcRenderer.invoke('os:getInfo'),
    getShellProfiles: () => electron_1.ipcRenderer.invoke('shell:getProfiles'),
    getDefaultShell: () => electron_1.ipcRenderer.invoke('shell:getDefault'),
    setDefaultShell: (profileId) => electron_1.ipcRenderer.invoke('shell:setDefault', profileId),
    installRazzShell: () => electron_1.ipcRenderer.invoke('shell:installRazzShell'),
    // Workspace & Files
    openDirectoryDialog: () => electron_1.ipcRenderer.invoke('workspace:openDialog'),
    listWorkspaceFiles: (dirPath) => electron_1.ipcRenderer.invoke('workspace:listFiles', dirPath),
    readFile: (filePath) => electron_1.ipcRenderer.invoke('workspace:readFile', filePath),
    writeFile: (filePath, content) => electron_1.ipcRenderer.invoke('workspace:writeFile', filePath, content),
    createFile: (filePath, initialContent) => electron_1.ipcRenderer.invoke('workspace:createFile', filePath, initialContent),
    createDirectory: (dirPath) => electron_1.ipcRenderer.invoke('workspace:createDirectory', dirPath),
    deleteFileOrDirectory: (targetPath) => electron_1.ipcRenderer.invoke('workspace:delete', targetPath),
    searchWorkspace: (query, options) => electron_1.ipcRenderer.invoke('workspace:search', query, options),
    // Terminal & Execution
    createTerminal: (options) => electron_1.ipcRenderer.invoke('terminal:create', options),
    writeTerminal: (terminalId, data) => electron_1.ipcRenderer.invoke('terminal:write', terminalId, data),
    resizeTerminal: (terminalId, cols, rows) => electron_1.ipcRenderer.invoke('terminal:resize', terminalId, cols, rows),
    closeTerminal: (terminalId) => electron_1.ipcRenderer.invoke('terminal:close', terminalId),
    executeCommand: (command, options) => electron_1.ipcRenderer.invoke('terminal:execute', command, options),
    onTerminalData: (callback) => {
        const listener = (_, data) => callback(data);
        electron_1.ipcRenderer.on('terminal:data', listener);
        return () => electron_1.ipcRenderer.removeListener('terminal:data', listener);
    },
    onTerminalExit: (callback) => {
        const listener = (_, data) => callback(data);
        electron_1.ipcRenderer.on('terminal:exit', listener);
        return () => electron_1.ipcRenderer.removeListener('terminal:exit', listener);
    },
    // AI Providers & Settings
    getAIConfigs: () => electron_1.ipcRenderer.invoke('ai:getConfigs'),
    saveAIConfig: (config) => electron_1.ipcRenderer.invoke('ai:saveConfig', config),
    testAIConnection: (providerId) => electron_1.ipcRenderer.invoke('ai:testConnection', providerId),
    sendAIChat: (params) => electron_1.ipcRenderer.invoke('ai:chat', params),
    streamAIChat: async (params, onChunk) => {
        const streamId = `stream_${Date.now()}`;
        const listener = (_, data) => {
            if (data.streamId === streamId) {
                onChunk(data.chunk);
            }
        };
        electron_1.ipcRenderer.on('ai:streamChunk', listener);
        try {
            await electron_1.ipcRenderer.invoke('ai:streamChat', { ...params, streamId });
        }
        finally {
            electron_1.ipcRenderer.removeListener('ai:streamChunk', listener);
        }
    },
    // Agent Core
    startAgentTask: (params) => electron_1.ipcRenderer.invoke('agent:startTask', params),
    cancelAgentTask: (taskId) => electron_1.ipcRenderer.invoke('agent:cancelTask', taskId),
    respondPermissionRequest: (decision) => electron_1.ipcRenderer.invoke('agent:respondPermission', decision),
    onAgentEvent: (callback) => {
        const listener = (_, event) => callback(event);
        electron_1.ipcRenderer.on('agent:event', listener);
        return () => electron_1.ipcRenderer.removeListener('agent:event', listener);
    },
    // Toolchains
    getToolchainCatalog: () => electron_1.ipcRenderer.invoke('toolchain:getCatalog'),
    installToolchain: (toolchainId) => electron_1.ipcRenderer.invoke('toolchain:install', toolchainId),
    verifyToolchain: (toolchainId) => electron_1.ipcRenderer.invoke('toolchain:verify', toolchainId),
    onToolchainProgress: (callback) => {
        const listener = (_, progress) => callback(progress);
        electron_1.ipcRenderer.on('toolchain:progress', listener);
        return () => electron_1.ipcRenderer.removeListener('toolchain:progress', listener);
    },
    // Git Integration
    getGitStatus: (cwd) => electron_1.ipcRenderer.invoke('git:getStatus', cwd),
    getGitDiff: (filePath, staged) => electron_1.ipcRenderer.invoke('git:getDiff', filePath, staged),
    gitStage: (filePaths) => electron_1.ipcRenderer.invoke('git:stage', filePaths),
    gitUnstage: (filePaths) => electron_1.ipcRenderer.invoke('git:unstage', filePaths),
    gitCommit: (message) => electron_1.ipcRenderer.invoke('git:commit', message),
    gitCreateBranch: (branchName) => electron_1.ipcRenderer.invoke('git:createBranch', branchName),
    gitCheckout: (branchOrCommit) => electron_1.ipcRenderer.invoke('git:checkout', branchOrCommit),
    getGitLog: (limit) => electron_1.ipcRenderer.invoke('git:getLog', limit),
    // Templates
    getProjectTemplates: () => electron_1.ipcRenderer.invoke('template:getTemplates'),
    createProjectFromTemplate: (params) => electron_1.ipcRenderer.invoke('template:createProject', params),
    // Window Controls
    minimizeWindow: () => electron_1.ipcRenderer.invoke('window:minimize'),
    maximizeWindow: () => electron_1.ipcRenderer.invoke('window:maximize'),
    closeWindow: () => electron_1.ipcRenderer.invoke('window:close'),
};
electron_1.contextBridge.exposeInMainWorld('ideAPI', api);
//# sourceMappingURL=index.js.map
import { contextBridge, ipcRenderer } from 'electron';
import {
  IdeApi,
  AIProviderConfig,
  AIProviderId,
  ChatMessage,
  ToolDefinition,
  AutonomyLevel,
  PermissionDecision,
  ShellType,
  TemplateType,
  StreamChunk,
  ToolchainInstallProgress,
} from '@ai-ide/shared';

const api: IdeApi = {
  // System & Shell
  getOSInfo: () => ipcRenderer.invoke('os:getInfo'),
  getShellProfiles: () => ipcRenderer.invoke('shell:getProfiles'),
  getDefaultShell: () => ipcRenderer.invoke('shell:getDefault'),
  setDefaultShell: (profileId: string) => ipcRenderer.invoke('shell:setDefault', profileId),
  installRazzShell: () => ipcRenderer.invoke('shell:installRazzShell'),

  // Workspace & Files
  openDirectoryDialog: () => ipcRenderer.invoke('workspace:openDialog'),
  listWorkspaceFiles: (dirPath?: string) => ipcRenderer.invoke('workspace:listFiles', dirPath),
  readFile: (filePath: string) => ipcRenderer.invoke('workspace:readFile', filePath),
  writeFile: (filePath: string, content: string) => ipcRenderer.invoke('workspace:writeFile', filePath, content),
  createFile: (filePath: string, initialContent?: string) => ipcRenderer.invoke('workspace:createFile', filePath, initialContent),
  createDirectory: (dirPath: string) => ipcRenderer.invoke('workspace:createDirectory', dirPath),
  deleteFileOrDirectory: (targetPath: string) => ipcRenderer.invoke('workspace:delete', targetPath),
  searchWorkspace: (query: string, options?: { matchCase?: boolean; isRegex?: boolean }) =>
    ipcRenderer.invoke('workspace:search', query, options),

  // Terminal & Execution
  createTerminal: (options?: { shellType?: ShellType; cwd?: string }) =>
    ipcRenderer.invoke('terminal:create', options),
  writeTerminal: (terminalId: string, data: string) =>
    ipcRenderer.invoke('terminal:write', terminalId, data),
  resizeTerminal: (terminalId: string, cols: number, rows: number) =>
    ipcRenderer.invoke('terminal:resize', terminalId, cols, rows),
  closeTerminal: (terminalId: string) =>
    ipcRenderer.invoke('terminal:close', terminalId),
  executeCommand: (command: string, options?: { shellType?: ShellType; cwd?: string; timeoutMs?: number }) =>
    ipcRenderer.invoke('terminal:execute', command, options),
  onTerminalData: (callback) => {
    const listener = (_: any, data: { terminalId: string; data: string }) => callback(data);
    ipcRenderer.on('terminal:data', listener);
    return () => ipcRenderer.removeListener('terminal:data', listener);
  },
  onTerminalExit: (callback) => {
    const listener = (_: any, data: { terminalId: string; exitCode: number }) => callback(data);
    ipcRenderer.on('terminal:exit', listener);
    return () => ipcRenderer.removeListener('terminal:exit', listener);
  },

  // AI Providers & Settings
  getAIConfigs: () => ipcRenderer.invoke('ai:getConfigs'),
  saveAIConfig: (config: AIProviderConfig) => ipcRenderer.invoke('ai:saveConfig', config),
  testAIConnection: (providerId: AIProviderId) => ipcRenderer.invoke('ai:testConnection', providerId),
  sendAIChat: (params: {
    providerId: AIProviderId;
    model: string;
    messages: ChatMessage[];
    tools?: ToolDefinition[];
    temperature?: number;
  }) => ipcRenderer.invoke('ai:chat', params),
  streamAIChat: async (params, onChunk) => {
    const streamId = `stream_${Date.now()}`;
    const listener = (_: any, data: { streamId: string; chunk: StreamChunk }) => {
      if (data.streamId === streamId) {
        onChunk(data.chunk);
      }
    };
    ipcRenderer.on('ai:streamChunk', listener);
    try {
      await ipcRenderer.invoke('ai:streamChat', { ...params, streamId });
    } finally {
      ipcRenderer.removeListener('ai:streamChunk', listener);
    }
  },

  // Agent Core
  startAgentTask: (params: { goal: string; autonomyLevel: AutonomyLevel }) =>
    ipcRenderer.invoke('agent:startTask', params),
  cancelAgentTask: (taskId: string) => ipcRenderer.invoke('agent:cancelTask', taskId),
  respondPermissionRequest: (decision: PermissionDecision) =>
    ipcRenderer.invoke('agent:respondPermission', decision),
  onAgentEvent: (callback) => {
    const listener = (_: any, event: any) => callback(event);
    ipcRenderer.on('agent:event', listener);
    return () => ipcRenderer.removeListener('agent:event', listener);
  },

  // Toolchains
  getToolchainCatalog: () => ipcRenderer.invoke('toolchain:getCatalog'),
  installToolchain: (toolchainId: string) => ipcRenderer.invoke('toolchain:install', toolchainId),
  verifyToolchain: (toolchainId: string) => ipcRenderer.invoke('toolchain:verify', toolchainId),
  onToolchainProgress: (callback) => {
    const listener = (_: any, progress: ToolchainInstallProgress) => callback(progress);
    ipcRenderer.on('toolchain:progress', listener);
    return () => ipcRenderer.removeListener('toolchain:progress', listener);
  },

  // Git Integration
  getGitStatus: (cwd?: string) => ipcRenderer.invoke('git:getStatus', cwd),
  getGitDiff: (filePath?: string, staged?: boolean) => ipcRenderer.invoke('git:getDiff', filePath, staged),
  gitStage: (filePaths: string[]) => ipcRenderer.invoke('git:stage', filePaths),
  gitUnstage: (filePaths: string[]) => ipcRenderer.invoke('git:unstage', filePaths),
  gitCommit: (message: string) => ipcRenderer.invoke('git:commit', message),
  gitCreateBranch: (branchName: string) => ipcRenderer.invoke('git:createBranch', branchName),
  gitCheckout: (branchOrCommit: string) => ipcRenderer.invoke('git:checkout', branchOrCommit),
  getGitLog: (limit?: number) => ipcRenderer.invoke('git:getLog', limit),

  // Templates
  getProjectTemplates: () => ipcRenderer.invoke('template:getTemplates'),
  createProjectFromTemplate: (params) => ipcRenderer.invoke('template:createProject', params),

  // Window Controls
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
};

contextBridge.exposeInMainWorld('ideAPI', api);

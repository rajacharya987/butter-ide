/**
 * @ai-ide/shared
 * Master types and contracts for the AI-First Desktop IDE with RazzShell.
 */

// ==========================================
// 1. Operating System & Platform Detection
// ==========================================

export type OSType = 'arch' | 'ubuntu' | 'debian' | 'fedora' | 'linux' | 'windows' | 'macos' | 'unknown';

export interface OSInfo {
  osType: OSType;
  platform: 'linux' | 'win32' | 'darwin';
  distName: string;
  distVersion?: string;
  arch: string;
  release: string;
  isArch: boolean;
  isUbuntuOrDebian: boolean;
  isWindows: boolean;
  isMacOS: boolean;
  defaultRecommendedShell: ShellType;
}

// ==========================================
// 2. Shell & Terminal Types
// ==========================================

export type ShellType = 'razzshell' | 'powershell' | 'bash' | 'zsh' | 'sh' | 'cmd';

export type ShellMode = 'native' | 'posix' | 'bash';

export interface ShellProfile {
  id: string;
  name: string;
  shellType: ShellType;
  executablePath: string;
  args?: string[];
  env?: Record<string, string>;
  isDefault?: boolean;
  isAvailable: boolean;
  version?: string;
  description: string;
}

export type ShellCapabilityCategory =
  | 'navigation'
  | 'file_ops'
  | 'process'
  | 'system'
  | 'alias'
  | 'ai'
  | 'utility'
  | 'session';

export interface ShellCapability {
  shellType: ShellType;
  name: string;
  command: string;
  posixEquivalent?: string;
  description: string;
  category: ShellCapabilityCategory;
  example: string;
}

export interface TerminalInstance {
  id: string;
  title: string;
  shellType: ShellType;
  cwd: string;
  pid?: number;
  active: boolean;
  mode?: ShellMode;
}

export interface ExecutionResult {
  command: string;
  shellType: ShellType;
  cwd: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  error?: string;
}

// ==========================================
// 3. AI Providers & Model Settings
// ==========================================

export type AIProviderId = 'claude' | 'openai' | 'gemini' | 'grok' | 'custom_openai';

export interface AIProviderConfig {
  id: AIProviderId;
  displayName: string;
  enabled: boolean;
  apiKey?: string;
  baseUrl?: string;
  defaultModel: string;
  availableModels: string[];
  requestTimeoutMs?: number;
  maxTokens?: number;
  customHeaders?: Record<string, string>;
  isLocal?: boolean;
  supportsStreaming: boolean;
  supportsToolCalling: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  timestamp: number;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface ToolResult {
  toolCallId: string;
  toolName: string;
  success: boolean;
  data?: any;
  error?: string;
  output?: string;
  exitCode?: number;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd?: number;
}

export interface StreamChunk {
  type: 'text' | 'tool_call' | 'usage' | 'error' | 'done';
  text?: string;
  toolCall?: Partial<ToolCall>;
  tokenUsage?: TokenUsage;
  error?: string;
}

export interface ConnectionTestResult {
  providerId: AIProviderId;
  success: boolean;
  model: string;
  latencyMs: number;
  error?: string;
}

// ==========================================
// 4. Autonomous Agent Core & Planning
// ==========================================

export type AutonomyLevel = 'ask' | 'supervised' | 'autonomous';

export type AgentTaskStatus =
  | 'idle'
  | 'planning'
  | 'waiting_approval'
  | 'executing'
  | 'verifying'
  | 'repairing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface PlanStep {
  id: string;
  index: number;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  toolName?: string;
  toolArgs?: Record<string, any>;
  verifiableCriteria: string;
  resultSummary?: string;
  error?: string;
}

export interface AgentPlan {
  taskId: string;
  goal: string;
  steps: PlanStep[];
  currentStepIndex: number;
  createdAt: number;
  updatedAt: number;
}

export type PermissionSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface PermissionRequest {
  id: string;
  taskId: string;
  actionType: 'file_edit' | 'shell_exec' | 'toolchain_install' | 'git_destructive' | 'network';
  target: string;
  command?: string;
  diff?: {
    filePath: string;
    oldContent: string;
    newContent: string;
  };
  reason: string;
  severity: PermissionSeverity;
  requiresExplicitApproval: boolean;
}

export interface PermissionDecision {
  requestId: string;
  approved: boolean;
  rejectReason?: string;
}

export interface ProjectMemory {
  id: string;
  workspaceRoot: string;
  key: string;
  value: string;
  category: 'convention' | 'build_system' | 'architecture' | 'decision';
  createdAt: number;
}

export interface AgentSessionSummary {
  taskId: string;
  goal: string;
  status: AgentTaskStatus;
  modifiedFiles: string[];
  executedCommands: { command: string; exitCode: number; success: boolean }[];
  verifiedResults: string[];
  unresolvedErrors: string[];
  tokenUsage: TokenUsage;
}

// ==========================================
// 5. Toolchain Manager & Installation Recipes
// ==========================================

export type ToolchainCategory = 'language' | 'build_tool' | 'runtime' | 'debugger' | 'vcs';

export interface ToolchainItem {
  id: string;
  name: string;
  category: ToolchainCategory;
  description: string;
  detectedVersion?: string;
  recommendedVersion: string;
  isInstalled: boolean;
  isCompatible: boolean;
  homepageUrl: string;
  dependencies?: string[];
  verificationCommand: string;
  packageNames: {
    arch?: string;
    ubuntu?: string;
    fedora?: string;
    windows?: string;
    macos?: string;
  };
}

export type InstallStatus = 'idle' | 'installing' | 'verifying' | 'installed' | 'failed';

export interface ToolchainInstallProgress {
  toolchainId: string;
  status: InstallStatus;
  stepMessage: string;
  percent: number;
  logs: string[];
  error?: string;
}

// ==========================================
// 6. Workspace, Files, Git & Projects
// ==========================================

export interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  modifiedTime?: number;
  children?: FileNode[];
}

export interface FileDiff {
  filePath: string;
  oldContent: string;
  newContent: string;
  additions: number;
  deletions: number;
}

export interface GitStatusResult {
  currentBranch: string;
  isClean: boolean;
  staged: GitFileStatus[];
  unstaged: GitFileStatus[];
  untracked: string[];
  ahead: number;
  behind: number;
}

export interface GitFileStatus {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked';
}

export interface GitCommit {
  hash: string;
  shortHash: string;
  author: string;
  date: string;
  message: string;
}

export type DiagnosticSeverity = 'error' | 'warning' | 'info' | 'hint';

export interface Diagnostic {
  filePath: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  message: string;
  severity: DiagnosticSeverity;
  source?: string;
  code?: string | number;
}

export type TemplateType = 'cpp-cmake' | 'rust-app' | 'go-app' | 'python-app' | 'node-ts-app';

export interface ProjectTemplate {
  id: TemplateType;
  name: string;
  language: string;
  description: string;
  defaultBuildCmd: string;
  defaultRunCmd: string;
  defaultTestCmd: string;
  requiredToolchains: string[];
}

export interface ProjectMetadata {
  name: string;
  rootPath: string;
  language?: string;
  buildSystem?: string;
  hasGit: boolean;
  isRazzShellWorkspace: boolean;
}

// ==========================================
// 7. Typed IPC Bridge Contract (window.ideAPI)
// ==========================================

export interface IdeApi {
  // System & Environment
  getOSInfo(): Promise<OSInfo>;
  getShellProfiles(): Promise<ShellProfile[]>;
  getDefaultShell(): Promise<ShellProfile>;
  setDefaultShell(profileId: string): Promise<void>;
  installRazzShell(): Promise<{ success: boolean; output: string; error?: string }>;

  // Workspace & Files
  openDirectoryDialog(): Promise<string | null>;
  listWorkspaceFiles(dirPath?: string): Promise<FileNode[]>;
  readFile(filePath: string): Promise<string>;
  writeFile(filePath: string, content: string): Promise<void>;
  createFile(filePath: string, initialContent?: string): Promise<void>;
  createDirectory(dirPath: string): Promise<void>;
  deleteFileOrDirectory(targetPath: string): Promise<void>;
  searchWorkspace(query: string, options?: { matchCase?: boolean; isRegex?: boolean }): Promise<Array<{ path: string; line: number; text: string }>>;

  // Terminal & Shell Execution
  createTerminal(options?: { shellType?: ShellType; cwd?: string }): Promise<TerminalInstance>;
  writeTerminal(terminalId: string, data: string): Promise<void>;
  resizeTerminal(terminalId: string, cols: number, rows: number): Promise<void>;
  closeTerminal(terminalId: string): Promise<void>;
  executeCommand(command: string, options?: { shellType?: ShellType; cwd?: string; timeoutMs?: number }): Promise<ExecutionResult>;
  onTerminalData(callback: (event: { terminalId: string; data: string }) => void): () => void;
  onTerminalExit(callback: (event: { terminalId: string; exitCode: number }) => void): () => void;

  // AI Providers & Settings
  getAIConfigs(): Promise<AIProviderConfig[]>;
  saveAIConfig(config: AIProviderConfig): Promise<void>;
  testAIConnection(providerId: AIProviderId): Promise<ConnectionTestResult>;
  sendAIChat(params: {
    providerId: AIProviderId;
    model: string;
    messages: ChatMessage[];
    tools?: ToolDefinition[];
    temperature?: number;
  }): Promise<{ content: string; toolCalls?: ToolCall[]; usage?: TokenUsage }>;
  streamAIChat(
    params: {
      providerId: AIProviderId;
      model: string;
      messages: ChatMessage[];
      tools?: ToolDefinition[];
      temperature?: number;
    },
    onChunk: (chunk: StreamChunk) => void
  ): Promise<void>;

  // AI Agent Lifecycle & Tools
  startAgentTask(params: { goal: string; autonomyLevel: AutonomyLevel }): Promise<{ taskId: string }>;
  cancelAgentTask(taskId: string): Promise<void>;
  respondPermissionRequest(decision: PermissionDecision): Promise<void>;
  onAgentEvent(callback: (event: {
    taskId: string;
    type: 'plan_updated' | 'step_started' | 'step_completed' | 'permission_requested' | 'tool_executed' | 'status_changed' | 'message';
    payload: any;
  }) => void): () => void;

  // Toolchains
  getToolchainCatalog(): Promise<ToolchainItem[]>;
  installToolchain(toolchainId: string): Promise<void>;
  verifyToolchain(toolchainId: string): Promise<{ isInstalled: boolean; version?: string }>;
  onToolchainProgress(callback: (progress: ToolchainInstallProgress) => void): () => void;

  // Git Integration
  getGitStatus(cwd?: string): Promise<GitStatusResult>;
  getGitDiff(filePath?: string, staged?: boolean): Promise<string>;
  gitStage(filePaths: string[]): Promise<void>;
  gitUnstage(filePaths: string[]): Promise<void>;
  gitCommit(message: string): Promise<void>;
  gitCreateBranch(branchName: string): Promise<void>;
  gitCheckout(branchOrCommit: string): Promise<void>;
  getGitLog(limit?: number): Promise<GitCommit[]>;

  // Templates & Wizards
  getProjectTemplates(): Promise<ProjectTemplate[]>;
  createProjectFromTemplate(params: {
    templateId: TemplateType;
    targetDir: string;
    projectName: string;
  }): Promise<{ projectPath: string }>;

  // Window Controls
  minimizeWindow(): Promise<void>;
  maximizeWindow(): Promise<void>;
  closeWindow(): Promise<void>;
}

declare global {
  interface Window {
    ideAPI: IdeApi;
  }
}

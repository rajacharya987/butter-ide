import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import {
  FolderTree,
  Search,
  GitBranch,
  Cpu,
  Bot,
  Settings as SettingsIcon,
  Plus,
  Play,
  RotateCw,
  Trash2,
  CheckCircle,
  AlertTriangle,
  XCircle,
  FileCode,
  Folder,
  ChevronRight,
  ChevronDown,
  Terminal as TerminalIcon,
  Save,
  ShieldAlert,
  Sparkles,
  Zap,
  Code2,
} from 'lucide-react';

import {
  FileNode,
  ShellProfile,
  OSInfo,
  AIProviderConfig,
  AIProviderId,
  ToolchainItem,
  GitStatusResult,
  AgentPlan,
  PermissionRequest,
  AutonomyLevel,
  TemplateType,
  ProjectTemplate,
} from '@ai-ide/shared';

// Mock/fallback API in browser preview if window.ideAPI is missing
const api = window.ideAPI || {
  getOSInfo: async () => ({
    osType: 'arch',
    platform: 'linux',
    distName: 'Arch Linux',
    arch: 'x64',
    release: '7.2.6',
    isArch: true,
    isUbuntuOrDebian: false,
    isWindows: false,
    isMacOS: false,
    defaultRecommendedShell: 'razzshell',
  }),
  getShellProfiles: async () => [
    {
      id: 'razzshell',
      name: 'RazzShell',
      shellType: 'razzshell',
      executablePath: '/home/dedsec/.local/bin/razzshell',
      isDefault: true,
      isAvailable: true,
      version: '2.0.0',
      description: 'First-class AI & cyber shell',
    },
    {
      id: 'bash',
      name: 'Bash',
      shellType: 'bash',
      executablePath: '/bin/bash',
      isDefault: false,
      isAvailable: true,
      version: '5.2',
      description: 'Standard GNU Bash',
    },
  ],
  getDefaultShell: async () => ({
    id: 'razzshell',
    name: 'RazzShell',
    shellType: 'razzshell',
    executablePath: '/home/dedsec/.local/bin/razzshell',
    isDefault: true,
    isAvailable: true,
    version: '2.0.0',
    description: 'First-class AI & cyber shell',
  }),
  setDefaultShell: async () => {},
  installRazzShell: async () => ({ success: true, output: 'Installed' }),
  openDirectoryDialog: async () => '/home/dedsec/butter',
  listWorkspaceFiles: async () => [],
  readFile: async () => '',
  writeFile: async () => {},
  createFile: async () => {},
  createDirectory: async () => {},
  deleteFileOrDirectory: async () => {},
  searchWorkspace: async () => [],
  createTerminal: async () => ({
    id: 'term_1',
    title: 'RazzShell',
    shellType: 'razzshell',
    cwd: '/home/dedsec/butter',
    active: true,
  }),
  writeTerminal: async () => {},
  resizeTerminal: async () => {},
  closeTerminal: async () => {},
  executeCommand: async () => ({
    command: '',
    shellType: 'razzshell',
    cwd: '',
    exitCode: 0,
    stdout: '',
    stderr: '',
    durationMs: 10,
  }),
  onTerminalData: () => () => {},
  onTerminalExit: () => () => {},
  getAIConfigs: async () => [],
  saveAIConfig: async () => {},
  testAIConnection: async () => ({ providerId: 'custom_openai', success: true, model: 'llama3.2', latencyMs: 25 }),
  sendAIChat: async () => ({ content: 'AI Response' }),
  streamAIChat: async () => {},
  startAgentTask: async () => ({ taskId: 'task_1' }),
  cancelAgentTask: async () => {},
  respondPermissionRequest: async () => {},
  onAgentEvent: () => () => {},
  getToolchainCatalog: async () => [],
  installToolchain: async () => {},
  verifyToolchain: async () => ({ isInstalled: true }),
  onToolchainProgress: () => () => {},
  getGitStatus: async () => ({
    currentBranch: 'main',
    isClean: true,
    staged: [],
    unstaged: [],
    untracked: [],
    ahead: 0,
    behind: 0,
  }),
  getGitDiff: async () => '',
  gitStage: async () => {},
  gitUnstage: async () => {},
  gitCommit: async () => {},
  gitCreateBranch: async () => {},
  gitCheckout: async () => {},
  getGitLog: async () => [],
  getProjectTemplates: async () => [],
  createProjectFromTemplate: async () => ({ projectPath: '' }),
  minimizeWindow: async () => {},
  maximizeWindow: async () => {},
  closeWindow: async () => {},
};

export default function App() {
  // Navigation & Layout State
  const [activeTab, setActiveTab] = useState<'explorer' | 'search' | 'git' | 'toolchains' | 'agent' | 'settings'>('explorer');
  const [bottomTab, setBottomTab] = useState<'terminal' | 'output' | 'problems'>('terminal');
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(true);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);

  // System & Shell State
  const [osInfo, setOsInfo] = useState<OSInfo | null>(null);
  const [shellProfiles, setShellProfiles] = useState<ShellProfile[]>([]);
  const [selectedShell, setSelectedShell] = useState<string>('razzshell');

  // Workspace & Editor State
  const [workspaceFiles, setWorkspaceFiles] = useState<FileNode[]>([]);
  const [openFiles, setOpenFiles] = useState<{ path: string; name: string; content: string; isDirty: boolean }[]>([]);
  const [activeFileIndex, setActiveFileIndex] = useState<number>(-1);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ path: string; line: number; text: string }>>([]);

  // Terminal State
  const [terminals, setTerminals] = useState<Array<{ id: string; title: string; shellType: string }>>([]);
  const [activeTerminalId, setActiveTerminalId] = useState<string>('');
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermInstance = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);

  // AI & Agent State
  const [aiConfigs, setAiConfigs] = useState<AIProviderConfig[]>([]);
  const [activeAiProvider, setActiveAiProvider] = useState<AIProviderId>('custom_openai');
  const [agentGoal, setAgentGoal] = useState('');
  const [autonomyLevel, setAutonomyLevel] = useState<AutonomyLevel>('supervised');
  const [agentStatus, setAgentStatus] = useState<string>('idle');
  const [agentPlan, setAgentPlan] = useState<AgentPlan | null>(null);
  const [agentMessages, setAgentMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [permissionRequest, setPermissionRequest] = useState<PermissionRequest | null>(null);

  // Toolchains & Git State
  const [toolchains, setToolchains] = useState<ToolchainItem[]>([]);
  const [toolchainFilter, setToolchainFilter] = useState('');
  const [toolchainLogs, setToolchainLogs] = useState<string[]>([]);
  const [gitStatus, setGitStatus] = useState<GitStatusResult | null>(null);
  const [commitMessage, setCommitMessage] = useState('');
  const [gitDiff, setGitDiff] = useState('');

  // Initial Data Load
  useEffect(() => {
    async function init() {
      try {
        const os = await api.getOSInfo();
        setOsInfo(os);

        const profiles = await api.getShellProfiles();
        setShellProfiles(profiles);

        const defShell = await api.getDefaultShell();
        if (defShell) setSelectedShell(defShell.shellType);

        // First run detection: if on Arch/Ubuntu and razzshell not installed, show welcome
        const razzProf = profiles.find((p) => p.shellType === 'razzshell');
        if (os.isArch && (!razzProf || !razzProf.isAvailable)) {
          setShowWelcomeModal(true);
        }

        const files = await api.listWorkspaceFiles();
        setWorkspaceFiles(files);

        const tcs = await api.getToolchainCatalog();
        setToolchains(tcs);

        const cfgs = await api.getAIConfigs();
        setAiConfigs(cfgs);

        const git = await api.getGitStatus();
        setGitStatus(git);

        // Spawn initial terminal
        initTerminal(defShell ? defShell.shellType : 'razzshell');
      } catch (err) {
        console.error('Initialization error:', err);
      }
    }
    init();

    // Setup Agent Event Listener
    const cleanupAgent = api.onAgentEvent((event) => {
      if (event.type === 'plan_updated') setAgentPlan(event.payload.plan);
      if (event.type === 'status_changed') setAgentStatus(event.payload.status);
      if (event.type === 'permission_requested') setPermissionRequest(event.payload);
      if (event.type === 'message') {
        setAgentMessages((prev) => [...prev, event.payload]);
      }
    });

    return () => {
      cleanupAgent();
    };
  }, []);

  // Initialize xterm.js Terminal
  const initTerminal = async (shellType: string) => {
    try {
      const termInstance = await api.createTerminal({ shellType: shellType as any });
      setTerminals((prev) => [...prev, { id: termInstance.id, title: termInstance.title, shellType }]);
      setActiveTerminalId(termInstance.id);

      if (terminalRef.current && !xtermInstance.current) {
        const term = new Terminal({
          cursorBlink: true,
          theme: {
            background: '#0d1117',
            foreground: '#c9d1d9',
            cursor: '#00ffcc',
            selectionBackground: '#30363d',
            black: '#0d1117',
            red: '#f85149',
            green: '#3fb950',
            yellow: '#d29922',
            blue: '#58a6ff',
            magenta: '#bc8cff',
            cyan: '#00ffcc',
            white: '#f0f6fc',
          },
          fontFamily: 'Fira Code, monospace',
          fontSize: 13,
          lineHeight: 1.2,
        });

        const fit = new FitAddon();
        term.loadAddon(fit);
        term.open(terminalRef.current);
        fit.fit();

        term.onData((data) => {
          api.writeTerminal(termInstance.id, data);
        });

        xtermInstance.current = term;
        fitAddon.current = fit;

        api.onTerminalData(({ terminalId, data }) => {
          if (terminalId === termInstance.id) {
            term.write(data);
          }
        });
      }
    } catch (err) {
      console.error('Failed to spawn terminal:', err);
    }
  };

  // Open file in Monaco tab
  const handleOpenFile = async (filePath: string, name: string) => {
    const existingIndex = openFiles.findIndex((f) => f.path === filePath);
    if (existingIndex >= 0) {
      setActiveFileIndex(existingIndex);
      return;
    }
    try {
      const content = await api.readFile(filePath);
      setOpenFiles((prev) => [...prev, { path: filePath, name, content, isDirty: false }]);
      setActiveFileIndex(openFiles.length);
    } catch (err: any) {
      alert(`Cannot open file: ${err.message}`);
    }
  };

  const handleSaveActiveFile = async () => {
    if (activeFileIndex < 0 || !openFiles[activeFileIndex]) return;
    const file = openFiles[activeFileIndex];
    await api.writeFile(file.path, file.content);
    setOpenFiles((prev) =>
      prev.map((f, i) => (i === activeFileIndex ? { ...f, isDirty: false } : f))
    );
  };

  const handleStartAgentTask = async () => {
    if (!agentGoal.trim()) return;
    setAgentStatus('planning');
    setAgentMessages([{ role: 'user', content: agentGoal }]);
    await api.startAgentTask({ goal: agentGoal, autonomyLevel });
  };

  const handleInstallToolchain = async (id: string) => {
    await api.installToolchain(id);
    const updated = await api.getToolchainCatalog();
    setToolchains(updated);
  };

  const currentFile = openFiles[activeFileIndex];

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0d1117] text-[#c9d1d9] overflow-hidden">
      {/* Top Header / Window Bar */}
      <header className="h-9 bg-[#161b22] border-b border-[#30363d] flex items-center justify-between px-3 select-none">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-[#00ffcc]" />
          <span className="font-semibold text-xs tracking-wider uppercase text-white">AI-First IDE</span>
          <span className="text-xs text-[#8b949e]">|</span>
          <span className="text-xs text-[#8b949e] flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#00ffcc]"></span>
            {selectedShell === 'razzshell' ? 'RazzShell v2.0.0 (Native Cyber)' : selectedShell}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowNewProjectModal(true)}
            className="text-xs bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] px-2.5 py-1 rounded flex items-center gap-1.5 transition-colors border border-[#30363d]"
          >
            <Code2 className="w-3.5 h-3.5 text-[#58a6ff]" />
            New Project
          </button>
          <button
            onClick={async () => {
              const dir = await api.openDirectoryDialog();
              if (dir) {
                const files = await api.listWorkspaceFiles();
                setWorkspaceFiles(files);
              }
            }}
            className="text-xs bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] px-2.5 py-1 rounded flex items-center gap-1.5 transition-colors border border-[#30363d]"
          >
            <Folder className="w-3.5 h-3.5 text-[#e3b341]" />
            Open Folder
          </button>
        </div>
      </header>

      {/* Main Workspace Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* 1. Activity Bar */}
        <aside className="w-12 bg-[#090d13] border-r border-[#30363d] flex flex-col items-center py-3 justify-between select-none">
          <div className="flex flex-col gap-4">
            <button
              onClick={() => setActiveTab('explorer')}
              title="Explorer"
              className={`p-2 rounded hover:text-white transition-colors ${
                activeTab === 'explorer' ? 'text-[#00ffcc] bg-[#161b22]' : 'text-[#8b949e]'
              }`}
            >
              <FolderTree className="w-5 h-5" />
            </button>
            <button
              onClick={() => setActiveTab('search')}
              title="Search"
              className={`p-2 rounded hover:text-white transition-colors ${
                activeTab === 'search' ? 'text-[#00ffcc] bg-[#161b22]' : 'text-[#8b949e]'
              }`}
            >
              <Search className="w-5 h-5" />
            </button>
            <button
              onClick={() => setActiveTab('git')}
              title="Source Control"
              className={`p-2 rounded hover:text-white transition-colors ${
                activeTab === 'git' ? 'text-[#00ffcc] bg-[#161b22]' : 'text-[#8b949e]'
              }`}
            >
              <GitBranch className="w-5 h-5" />
            </button>
            <button
              onClick={() => setActiveTab('toolchains')}
              title="Toolchain Manager"
              className={`p-2 rounded hover:text-white transition-colors ${
                activeTab === 'toolchains' ? 'text-[#00ffcc] bg-[#161b22]' : 'text-[#8b949e]'
              }`}
            >
              <Cpu className="w-5 h-5" />
            </button>
            <button
              onClick={() => setActiveTab('agent')}
              title="AI Agent Core"
              className={`p-2 rounded hover:text-white transition-colors ${
                activeTab === 'agent' ? 'text-[#00ffcc] bg-[#161b22]' : 'text-[#8b949e]'
              }`}
            >
              <Bot className="w-5 h-5" />
            </button>
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={() => setActiveTab('settings')}
              title="Settings"
              className={`p-2 rounded hover:text-white transition-colors ${
                activeTab === 'settings' ? 'text-[#00ffcc] bg-[#161b22]' : 'text-[#8b949e]'
              }`}
            >
              <SettingsIcon className="w-5 h-5" />
            </button>
          </div>
        </aside>

        {/* 2. Left Sidebar */}
        <section className="w-64 bg-[#161b22] border-r border-[#30363d] flex flex-col overflow-hidden">
          {/* Explorer View */}
          {activeTab === 'explorer' && (
            <div className="flex flex-col h-full">
              <div className="h-9 px-3 border-b border-[#30363d] flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-[#8b949e]">
                <span>Explorer</span>
                <div className="flex gap-1">
                  <button
                    onClick={async () => {
                      const files = await api.listWorkspaceFiles();
                      setWorkspaceFiles(files);
                    }}
                    title="Refresh"
                    className="p-1 hover:text-white"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {workspaceFiles.map((node) => (
                  <div
                    key={node.path}
                    onClick={() => !node.isDirectory && handleOpenFile(node.path, node.name)}
                    className="flex items-center gap-2 py-1 px-2 rounded hover:bg-[#21262d] cursor-pointer text-xs"
                  >
                    {node.isDirectory ? (
                      <Folder className="w-3.5 h-3.5 text-[#58a6ff]" />
                    ) : (
                      <FileCode className="w-3.5 h-3.5 text-[#8b949e]" />
                    )}
                    <span className="truncate">{node.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Search View */}
          {activeTab === 'search' && (
            <div className="flex flex-col h-full p-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#8b949e] mb-2">Search</span>
              <input
                type="text"
                placeholder="Search across files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter') {
                    const results = await api.searchWorkspace(searchQuery);
                    setSearchResults(results);
                  }
                }}
                className="bg-[#0d1117] border border-[#30363d] rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#58a6ff] mb-3"
              />
              <div className="flex-1 overflow-y-auto space-y-2">
                {searchResults.map((res, i) => (
                  <div
                    key={i}
                    onClick={() => handleOpenFile(res.path, res.path.split('/').pop() || '')}
                    className="p-2 bg-[#21262d] rounded text-xs cursor-pointer hover:border hover:border-[#58a6ff]"
                  >
                    <div className="font-semibold text-[#58a6ff] truncate">
                      {res.path}:{res.line}
                    </div>
                    <div className="text-[#8b949e] truncate mt-1">{res.text}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Source Control View */}
          {activeTab === 'git' && (
            <div className="flex flex-col h-full p-3">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#8b949e]">Source Control</span>
                <span className="text-xs bg-[#21262d] px-2 py-0.5 rounded text-[#58a6ff]">
                  {gitStatus?.currentBranch || 'main'}
                </span>
              </div>
              <textarea
                placeholder="Commit message..."
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                rows={3}
                className="w-full bg-[#0d1117] border border-[#30363d] rounded p-2 text-xs text-white focus:outline-none focus:border-[#58a6ff] mb-2 resize-none"
              />
              <button
                onClick={async () => {
                  if (!commitMessage.trim()) return;
                  await api.gitCommit(commitMessage);
                  setCommitMessage('');
                  const stat = await api.getGitStatus();
                  setGitStatus(stat);
                }}
                className="w-full py-1.5 bg-[#238636] hover:bg-[#2ea043] text-white text-xs font-semibold rounded mb-4"
              >
                Commit Changes
              </button>
              <div className="text-xs text-[#8b949e] font-semibold mb-1">Changes</div>
              <div className="flex-1 overflow-y-auto space-y-1">
                {gitStatus?.unstaged.map((f) => (
                  <div key={f.path} className="flex items-center justify-between p-1 hover:bg-[#21262d] rounded text-xs">
                    <span className="truncate">{f.path}</span>
                    <span className="text-[#e3b341]">M</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Toolchains Catalog View */}
          {activeTab === 'toolchains' && (
            <div className="flex flex-col h-full p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#8b949e]">Toolchains</span>
                <span className="text-xs bg-[#21262d] px-1.5 py-0.5 rounded text-[#00ffcc]">
                  {toolchains.filter((t) => t.isInstalled).length}/{toolchains.length}
                </span>
              </div>
              <input
                type="text"
                placeholder="Filter compilers / tools..."
                value={toolchainFilter}
                onChange={(e) => setToolchainFilter(e.target.value)}
                className="bg-[#0d1117] border border-[#30363d] rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-[#58a6ff] mb-3"
              />
              <div className="flex-1 overflow-y-auto space-y-2">
                {toolchains
                  .filter((t) => t.name.toLowerCase().includes(toolchainFilter.toLowerCase()))
                  .map((t) => (
                    <div key={t.id} className="p-2.5 bg-[#21262d] border border-[#30363d] rounded text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-white">{t.name}</span>
                        {t.isInstalled ? (
                          <span className="text-[#3fb950] flex items-center gap-1 text-[10px]">
                            <CheckCircle className="w-3 h-3" /> {t.detectedVersion}
                          </span>
                        ) : (
                          <span className="text-[#8b949e] text-[10px]">Not installed</span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#8b949e] mb-2 leading-relaxed">{t.description}</p>
                      {!t.isInstalled && (
                        <button
                          onClick={() => handleInstallToolchain(t.id)}
                          className="w-full py-1 bg-[#1f6feb] hover:bg-[#388bfd] text-white rounded font-medium text-[11px]"
                        >
                          One-Click Install
                        </button>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Settings View */}
          {activeTab === 'settings' && (
            <div className="flex flex-col h-full p-3 overflow-y-auto">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#8b949e] mb-3">Settings</span>
              <div className="space-y-4 text-xs">
                <div>
                  <label className="text-[#8b949e] block mb-1">Active AI Provider</label>
                  <select
                    value={activeAiProvider}
                    onChange={(e) => setActiveAiProvider(e.target.value as any)}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded p-1.5 text-white"
                  >
                    <option value="custom_openai">Local / Custom (Ollama, LM Studio)</option>
                    <option value="claude">Anthropic Claude</option>
                    <option value="openai">OpenAI (GPT-4o)</option>
                    <option value="gemini">Google Gemini</option>
                    <option value="grok">xAI Grok</option>
                  </select>
                </div>
                <div>
                  <label className="text-[#8b949e] block mb-1">Active Shell</label>
                  <select
                    value={selectedShell}
                    onChange={(e) => {
                      setSelectedShell(e.target.value);
                      api.setDefaultShell(e.target.value);
                    }}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded p-1.5 text-white"
                  >
                    {shellProfiles.map((p) => (
                      <option key={p.id} value={p.shellType}>
                        {p.name} {p.shellType === 'razzshell' ? '(Recommended)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={async () => {
                    const res = await api.testAIConnection(activeAiProvider);
                    alert(`Connection: ${res.success ? 'Success (' + res.latencyMs + 'ms)' : 'Failed: ' + res.error}`);
                  }}
                  className="w-full py-1.5 bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] text-white rounded font-medium"
                >
                  Test AI Connection
                </button>
              </div>
            </div>
          )}
        </section>

        {/* 3. Center Editor & Bottom Panels */}
        <main className="flex-1 flex flex-col overflow-hidden bg-[#0d1117]">
          {/* Tab Bar */}
          <div className="h-9 bg-[#161b22] border-b border-[#30363d] flex items-center overflow-x-auto select-none">
            {openFiles.map((file, idx) => (
              <div
                key={file.path}
                onClick={() => setActiveFileIndex(idx)}
                className={`h-full px-3.5 flex items-center gap-2 border-r border-[#30363d] text-xs cursor-pointer ${
                  activeFileIndex === idx
                    ? 'bg-[#0d1117] text-white border-t-2 border-t-[#58a6ff]'
                    : 'text-[#8b949e] hover:bg-[#21262d]'
                }`}
              >
                <span>{file.name}</span>
                {file.isDirty && <span className="w-1.5 h-1.5 rounded-full bg-[#58a6ff]"></span>}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenFiles((prev) => prev.filter((_, i) => i !== idx));
                    if (activeFileIndex === idx) {
                      setActiveFileIndex(openFiles.length > 1 ? 0 : -1);
                    }
                  }}
                  className="hover:text-white"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          {/* Monaco Editor Container */}
          <div className="flex-1 relative overflow-hidden">
            {currentFile ? (
              <Editor
                height="100%"
                theme="vs-dark"
                path={currentFile.path}
                value={currentFile.content}
                onChange={(val) => {
                  setOpenFiles((prev) =>
                    prev.map((f, i) => (i === activeFileIndex ? { ...f, content: val || '', isDirty: true } : f))
                  );
                }}
                options={{
                  fontSize: 13,
                  fontFamily: 'Fira Code, monospace',
                  minimap: { enabled: true },
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                }}
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-[#8b949e]">
                <Sparkles className="w-12 h-12 text-[#00ffcc] mb-3 animate-pulse" />
                <h2 className="text-base font-semibold text-white mb-1">AI-First Desktop IDE with RazzShell</h2>
                <p className="text-xs mb-4">First-class autonomous coding agent with cyber shell workflows</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowNewProjectModal(true)}
                    className="px-3 py-1.5 bg-[#21262d] hover:bg-[#30363d] text-xs text-white rounded border border-[#30363d]"
                  >
                    New Starter Project
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Panel (Terminal / Output) */}
          <div className="h-56 bg-[#0d1117] border-t border-[#30363d] flex flex-col">
            <div className="h-8 bg-[#161b22] border-b border-[#30363d] flex items-center justify-between px-3 select-none">
              <div className="flex gap-3 text-xs">
                <button
                  onClick={() => setBottomTab('terminal')}
                  className={`font-semibold ${bottomTab === 'terminal' ? 'text-white border-b-2 border-[#00ffcc]' : 'text-[#8b949e]'}`}
                >
                  Terminal ({selectedShell})
                </button>
                <button
                  onClick={() => setBottomTab('output')}
                  className={`font-semibold ${bottomTab === 'output' ? 'text-white border-b-2 border-[#00ffcc]' : 'text-[#8b949e]'}`}
                >
                  Output
                </button>
                <button
                  onClick={() => setBottomTab('problems')}
                  className={`font-semibold ${bottomTab === 'problems' ? 'text-white border-b-2 border-[#00ffcc]' : 'text-[#8b949e]'}`}
                >
                  Problems (0)
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => initTerminal(selectedShell)}
                  title="New Terminal"
                  className="p-1 hover:text-white text-[#8b949e]"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden p-1 relative">
              <div ref={terminalRef} className={`h-full w-full ${bottomTab === 'terminal' ? 'block' : 'hidden'}`} />
              {bottomTab === 'output' && (
                <div className="p-3 font-mono text-xs text-[#8b949e] overflow-y-auto h-full">
                  <div>[System] AI IDE Desktop process initialized.</div>
                  <div>[RazzShell] Shell adapter registered for Arch Linux.</div>
                  <div>[Toolchains] Auto-discovery detected GCC, Clang, Rust, Go, Python, CMake, Git.</div>
                </div>
              )}
              {bottomTab === 'problems' && (
                <div className="p-3 text-xs text-[#8b949e]">No diagnostic problems found in workspace.</div>
              )}
            </div>
          </div>
        </main>

        {/* 4. Right AI Agent Panel */}
        {isAiPanelOpen && (
          <aside className="w-80 bg-[#161b22] border-l border-[#30363d] flex flex-col overflow-hidden">
            <div className="h-9 px-3 border-b border-[#30363d] flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-white">
              <div className="flex items-center gap-1.5">
                <Bot className="w-4 h-4 text-[#00ffcc]" />
                <span>AI Coding Agent</span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${agentStatus === 'executing' ? 'bg-[#1f6feb] text-white animate-pulse' : 'bg-[#21262d] text-[#8b949e]'}`}>
                {agentStatus.toUpperCase()}
              </span>
            </div>

            <div className="p-3 border-b border-[#30363d] bg-[#0d1117]">
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] text-[#8b949e]">Autonomy Level</label>
                <select
                  value={autonomyLevel}
                  onChange={(e) => setAutonomyLevel(e.target.value as any)}
                  className="bg-[#161b22] border border-[#30363d] rounded px-2 py-0.5 text-xs text-white"
                >
                  <option value="ask">Ask Permission</option>
                  <option value="supervised">Supervised (Standard)</option>
                  <option value="autonomous">Autonomous</option>
                </select>
              </div>
              <textarea
                placeholder="Instruct the agent (e.g. 'Create a C++ project and build it')..."
                value={agentGoal}
                onChange={(e) => setAgentGoal(e.target.value)}
                rows={3}
                className="w-full bg-[#161b22] border border-[#30363d] rounded p-2 text-xs text-white focus:outline-none focus:border-[#00ffcc] resize-none mb-2"
              />
              <button
                onClick={handleStartAgentTask}
                className="w-full py-1.5 bg-[#00ffcc] hover:bg-[#33ffdd] text-black font-semibold rounded text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5 fill-black" />
                Run Autonomous Task
              </button>
            </div>

            {/* Permission Request Prompt if Pending */}
            {permissionRequest && (
              <div className="m-3 p-3 bg-[#381e1e] border border-[#f85149] rounded text-xs">
                <div className="flex items-center gap-1.5 text-[#f85149] font-bold mb-1">
                  <ShieldAlert className="w-4 h-4" />
                  Permission Required
                </div>
                <p className="text-[11px] text-[#c9d1d9] mb-2">{permissionRequest.reason}</p>
                {permissionRequest.command && (
                  <div className="bg-[#0d1117] p-1.5 rounded font-mono text-[10px] text-white mb-2 truncate">
                    {permissionRequest.command}
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      api.respondPermissionRequest({ requestId: permissionRequest.id, approved: true });
                      setPermissionRequest(null);
                    }}
                    className="flex-1 py-1 bg-[#238636] hover:bg-[#2ea043] text-white font-semibold rounded"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => {
                      api.respondPermissionRequest({ requestId: permissionRequest.id, approved: false });
                      setPermissionRequest(null);
                    }}
                    className="flex-1 py-1 bg-[#21262d] hover:bg-[#30363d] text-white rounded"
                  >
                    Reject
                  </button>
                </div>
              </div>
            )}

            {/* Agent Plan Cards */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {agentPlan && (
                <div>
                  <div className="text-[11px] font-semibold text-[#8b949e] uppercase mb-2">Execution Plan</div>
                  <div className="space-y-2">
                    {agentPlan.steps.map((step, idx) => (
                      <div
                        key={step.id}
                        className={`p-2.5 rounded border text-xs ${
                          step.status === 'completed'
                            ? 'bg-[#1b2f21] border-[#3fb950]'
                            : step.status === 'in_progress'
                            ? 'bg-[#192b3d] border-[#58a6ff]'
                            : 'bg-[#21262d] border-[#30363d]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1 font-semibold">
                          <span className="text-white">
                            {idx + 1}. {step.title}
                          </span>
                          {step.status === 'completed' && <CheckCircle className="w-3.5 h-3.5 text-[#3fb950]" />}
                          {step.status === 'in_progress' && <RotateCw className="w-3.5 h-3.5 text-[#58a6ff] animate-spin" />}
                        </div>
                        <p className="text-[11px] text-[#8b949e]">{step.description}</p>
                        {step.resultSummary && (
                          <div className="mt-1.5 text-[10px] text-[#3fb950] font-mono">{step.resultSummary}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Message Feed */}
              {agentMessages.length > 0 && (
                <div className="pt-2">
                  <div className="text-[11px] font-semibold text-[#8b949e] uppercase mb-2">Action Logs</div>
                  <div className="space-y-2">
                    {agentMessages.map((m, i) => (
                      <div key={i} className="p-2 bg-[#21262d] rounded text-xs text-[#c9d1d9] leading-relaxed">
                        <span className="font-semibold text-[#00ffcc] block mb-0.5 capitalize">{m.role}:</span>
                        {m.content}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Status Bar */}
      <footer className="h-6 bg-[#161b22] border-t border-[#30363d] flex items-center justify-between px-3 text-[11px] text-[#8b949e] select-none">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-[#58a6ff]">
            <GitBranch className="w-3 h-3" />
            {gitStatus?.currentBranch || 'main'}
          </span>
          <span>0 errors, 0 warnings</span>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-[#00ffcc] font-mono">⚡ {selectedShell}</span>
          <span>UTF-8</span>
          <span>Ln 1, Col 1</span>
        </div>
      </footer>

      {/* First-Run Welcome Modal for Arch Linux & RazzShell */}
      {showWelcomeModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="w-[480px] bg-[#161b22] border border-[#30363d] rounded-lg p-5 shadow-2xl">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-6 h-6 text-[#00ffcc]" />
              <h3 className="text-base font-bold text-white">Welcome to AI-First IDE on Arch Linux</h3>
            </div>
            <p className="text-xs text-[#8b949e] mb-4 leading-relaxed">
              Arch Linux detected! RazzShell is the recommended first-class shell for this environment, featuring Universal Undo (`undo`), cyber-themed ANSI prompts, built-in AI diagnostics (`why`/`fix`), and object pipelines.
            </p>

            <div className="bg-[#0d1117] p-3 rounded border border-[#30363d] mb-4 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-white font-medium">Recommended Shell</span>
                <span className="text-[#00ffcc] font-semibold">RazzShell v2.0.0</span>
              </div>
              <div className="flex items-center justify-between text-[#8b949e]">
                <span>Native Fallback</span>
                <span>/bin/bash</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={async () => {
                  await api.installRazzShell();
                  setSelectedShell('razzshell');
                  setShowWelcomeModal(false);
                }}
                className="flex-1 py-2 bg-[#00ffcc] hover:bg-[#33ffdd] text-black font-semibold rounded text-xs"
              >
                Use RazzShell (Recommended)
              </button>
              <button
                onClick={() => {
                  setSelectedShell('bash');
                  setShowWelcomeModal(false);
                }}
                className="px-4 py-2 bg-[#21262d] hover:bg-[#30363d] text-white rounded text-xs"
              >
                Use Native Bash
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Project Creation Wizard Modal */}
      {showNewProjectModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="w-[520px] bg-[#161b22] border border-[#30363d] rounded-lg p-5 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2">Create New Project</h3>
            <p className="text-xs text-[#8b949e] mb-4">Select a language template to scaffold complete manifests and starter code.</p>

            <div className="grid grid-cols-2 gap-2 mb-4">
              {[
                { id: 'cpp-cmake', name: 'C++ (CMake)', desc: 'Modern C++20 with CMakeLists.txt' },
                { id: 'rust-app', name: 'Rust (Cargo)', desc: 'Fast binary with Cargo.toml' },
                { id: 'go-app', name: 'Go CLI', desc: 'Go 1.22 with go.mod' },
                { id: 'python-app', name: 'Python 3', desc: 'Standard script with requirements' },
              ].map((tmpl) => (
                <div
                  key={tmpl.id}
                  onClick={async () => {
                    await api.createProjectFromTemplate({
                      templateId: tmpl.id as any,
                      targetDir: '/home/dedsec/butter',
                      projectName: tmpl.id,
                    });
                    const files = await api.listWorkspaceFiles();
                    setWorkspaceFiles(files);
                    setShowNewProjectModal(false);
                  }}
                  className="p-3 bg-[#0d1117] border border-[#30363d] hover:border-[#58a6ff] rounded cursor-pointer transition-colors"
                >
                  <div className="font-semibold text-xs text-white">{tmpl.name}</div>
                  <div className="text-[11px] text-[#8b949e] mt-1">{tmpl.desc}</div>
                </div>
              ))}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowNewProjectModal(false)}
                className="px-4 py-1.5 bg-[#21262d] hover:bg-[#30363d] text-white rounded text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

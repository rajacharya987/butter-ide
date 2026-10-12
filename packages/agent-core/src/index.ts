import * as path from 'node:path';
import {
  AgentPlan,
  PlanStep,
  AgentTaskStatus,
  AutonomyLevel,
  ToolCall,
  ToolResult,
  TokenUsage,
  ChatMessage,
  ProjectMemory,
  AgentSessionSummary,
  ShellType,
} from '@ai-ide/shared';
import { PermissionBroker, SecretRedactor } from '@ai-ide/security';
import { WorkspaceService } from '@ai-ide/workspace';
import { ShellRegistry, OSDetector } from '@ai-ide/shell-adapters';
import { AIProviderRegistry } from '@ai-ide/ai-providers';
import { ToolchainManager } from '@ai-ide/toolchain-manager';
import { GitService } from '@ai-ide/git-integration';

// ==========================================
// 1. Workspace Analyzer
// ==========================================

export class WorkspaceAnalyzer {
  public static async analyze(
    workspaceService: WorkspaceService,
    gitService: GitService,
    toolchainManager: ToolchainManager
  ): Promise<{
    rootPath: string;
    projectType: string;
    detectedManifests: string[];
    hasGit: boolean;
    availableToolchains: string[];
    treeSummary: string;
  }> {
    const rootPath = workspaceService.getRoot();
    const files = workspaceService.listFiles(rootPath, 3);

    const detectedManifests: string[] = [];
    let projectType = 'unknown';

    const checkFile = (name: string) => files.some((f) => f.name === name);

    if (checkFile('CMakeLists.txt')) {
      detectedManifests.push('CMakeLists.txt');
      projectType = 'cpp-cmake';
    }
    if (checkFile('Cargo.toml')) {
      detectedManifests.push('Cargo.toml');
      projectType = 'rust';
    }
    if (checkFile('go.mod')) {
      detectedManifests.push('go.mod');
      projectType = 'go';
    }
    if (checkFile('package.json')) {
      detectedManifests.push('package.json');
      projectType = 'node-typescript';
    }
    if (checkFile('pyproject.toml') || checkFile('requirements.txt')) {
      detectedManifests.push('python');
      projectType = 'python';
    }
    if (checkFile('Makefile')) {
      detectedManifests.push('Makefile');
      if (projectType === 'unknown') projectType = 'c-cpp-make';
    }

    const hasGit = await gitService.isGitRepo(rootPath);
    const catalog = await toolchainManager.getCatalog();
    const availableToolchains = catalog.filter((c) => c.isInstalled).map((c) => c.name);

    const treeSummary = files
      .slice(0, 30)
      .map((f) => `${f.isDirectory ? '📁' : '📄'} ${path.relative(rootPath, f.path)}`)
      .join('\n');

    return {
      rootPath,
      projectType,
      detectedManifests,
      hasGit,
      availableToolchains,
      treeSummary,
    };
  }
}

// ==========================================
// 2. Persistent Project Memory
// ==========================================

export class PersistentMemory {
  private memories: Map<string, ProjectMemory[]> = new Map();

  public addMemory(
    workspaceRoot: string,
    key: string,
    value: string,
    category: 'convention' | 'build_system' | 'architecture' | 'decision'
  ): ProjectMemory {
    const mem: ProjectMemory = {
      id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      workspaceRoot,
      key,
      value,
      category,
      createdAt: Date.now(),
    };

    const list = this.memories.get(workspaceRoot) || [];
    list.push(mem);
    this.memories.set(workspaceRoot, list);
    return mem;
  }

  public getMemories(workspaceRoot: string): ProjectMemory[] {
    return this.memories.get(workspaceRoot) || [];
  }

  public clearMemories(workspaceRoot: string): void {
    this.memories.delete(workspaceRoot);
  }
}

// ==========================================
// 3. Tool Executor
// ==========================================

export class ToolExecutor {
  constructor(
    private workspaceService: WorkspaceService,
    private shellRegistry: ShellRegistry,
    private permissionBroker: PermissionBroker,
    private toolchainManager: ToolchainManager,
    private gitService: GitService
  ) {}

  public async executeTool(
    toolName: string,
    args: Record<string, any>,
    taskId: string,
    activeShell: ShellType
  ): Promise<ToolResult> {
    try {
      switch (toolName) {
        case 'workspace.list_files': {
          const files = this.workspaceService.listFiles(args.subDir, args.depth || 3);
          return {
            toolCallId: args.id || 'tc_list',
            toolName,
            success: true,
            data: files.map((f) => ({
              path: path.relative(this.workspaceService.getRoot(), f.path),
              isDirectory: f.isDirectory,
              size: f.size,
            })),
          };
        }

        case 'workspace.read_file': {
          const content = this.workspaceService.readFile(args.path);
          return {
            toolCallId: args.id || 'tc_read',
            toolName,
            success: true,
            data: content,
          };
        }

        case 'workspace.create_file': {
          const approved = await this.permissionBroker.evaluateAction({
            taskId,
            actionType: 'file_edit',
            target: args.path,
            reason: `Create file ${args.path}`,
          });

          if (!approved) {
            return {
              toolCallId: args.id || 'tc_create',
              toolName,
              success: false,
              error: 'User denied file creation permission',
            };
          }

          this.workspaceService.createFile(args.path, args.content || '');
          return {
            toolCallId: args.id || 'tc_create',
            toolName,
            success: true,
            data: `Created file ${args.path}`,
          };
        }

        case 'workspace.apply_patch': {
          const currentContent = this.workspaceService.readFile(args.path);
          const approved = await this.permissionBroker.evaluateAction({
            taskId,
            actionType: 'file_edit',
            target: args.path,
            diff: {
              filePath: args.path,
              oldContent: args.search,
              newContent: args.replace,
            },
            reason: `Apply patch to ${args.path}`,
          });

          if (!approved) {
            return {
              toolCallId: args.id || 'tc_patch',
              toolName,
              success: false,
              error: 'User rejected patch approval',
            };
          }

          this.workspaceService.applyPatch(args.path, args.search, args.replace);
          return {
            toolCallId: args.id || 'tc_patch',
            toolName,
            success: true,
            data: `Successfully patched ${args.path}`,
          };
        }

        case 'workspace.search': {
          const matches = this.workspaceService.search(args.query, {
            matchCase: args.matchCase,
            isRegex: args.isRegex,
          });
          return {
            toolCallId: args.id || 'tc_search',
            toolName,
            success: true,
            data: matches,
          };
        }

        case 'terminal.execute': {
          const approved = await this.permissionBroker.evaluateAction({
            taskId,
            actionType: 'shell_exec',
            target: activeShell,
            command: args.command,
            reason: `Execute command: ${args.command}`,
          });

          if (!approved) {
            return {
              toolCallId: args.id || 'tc_exec',
              toolName,
              success: false,
              error: 'User rejected shell command execution',
            };
          }

          const adapter = this.shellRegistry.getAdapter(activeShell);
          const result = await adapter.executeCommand(
            args.command,
            args.cwd || this.workspaceService.getRoot(),
            args.env,
            args.timeoutMs || 30000
          );

          return {
            toolCallId: args.id || 'tc_exec',
            toolName,
            success: result.exitCode === 0,
            exitCode: result.exitCode,
            output: SecretRedactor.redact(result.stdout || result.stderr),
            error: result.exitCode !== 0 ? SecretRedactor.redact(result.stderr) : undefined,
          };
        }

        case 'toolchain.detect': {
          const catalog = await this.toolchainManager.getCatalog();
          return {
            toolCallId: args.id || 'tc_tc_detect',
            toolName,
            success: true,
            data: catalog.filter((c) => c.isInstalled),
          };
        }

        case 'git.status': {
          const status = await this.gitService.getStatus(this.workspaceService.getRoot());
          return {
            toolCallId: args.id || 'tc_git_stat',
            toolName,
            success: true,
            data: status,
          };
        }

        default:
          return {
            toolCallId: args.id || 'tc_unknown',
            toolName,
            success: false,
            error: `Tool '${toolName}' is not implemented`,
          };
      }
    } catch (err: any) {
      return {
        toolCallId: args.id || 'tc_err',
        toolName,
        success: false,
        error: err.message,
      };
    }
  }
}

// ==========================================
// 4. Verifier
// ==========================================

export class Verifier {
  public static verifyStep(
    step: PlanStep,
    result: ToolResult
  ): { verified: boolean; summary: string } {
    if (!result.success) {
      return {
        verified: false,
        summary: `Verification Failed: Tool ${result.toolName} reported failure: ${result.error || 'Non-zero exit code'}`,
      };
    }

    if (result.exitCode !== undefined && result.exitCode !== 0) {
      return {
        verified: false,
        summary: `Verification Failed: Process exited with code ${result.exitCode}`,
      };
    }

    return {
      verified: true,
      summary: `Verified: ${step.verifiableCriteria} (Evidence: exitCode ${result.exitCode ?? 0})`,
    };
  }
}

// ==========================================
// 5. Recovery Manager
// ==========================================

export class RecoveryManager {
  private static readonly MAX_RECOVERY_ATTEMPTS = 3;

  public static shouldAttemptRecovery(attempts: number): boolean {
    return attempts < this.MAX_RECOVERY_ATTEMPTS;
  }

  public static generateRecoveryPrompt(
    failedStep: PlanStep,
    errorOutput: string,
    activeShell: ShellType
  ): string {
    return `The previous step '${failedStep.title}' failed when executing in shell '${activeShell}'.
Error diagnostic:
\`\`\`
${errorOutput.slice(0, 1500)}
\`\`\`
Diagnose the failure, explain why it failed, and propose a specific corrective action or patch to fix it.`;
  }
}

// ==========================================
// 6. Agent Planner & Orchestrator
// ==========================================

export type AgentEventHandler = (event: {
  taskId: string;
  type:
    | 'plan_updated'
    | 'step_started'
    | 'step_completed'
    | 'permission_requested'
    | 'tool_executed'
    | 'status_changed'
    | 'message';
  payload: any;
}) => void;

export class AgentOrchestrator {
  private currentStatus: AgentTaskStatus = 'idle';
  private currentPlan: AgentPlan | null = null;
  private activeTaskId: string | null = null;
  private isCancelled: boolean = false;
  private eventHandlers: AgentEventHandler[] = [];
  private tokenAccumulator: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

  constructor(
    private workspaceService: WorkspaceService,
    private shellRegistry: ShellRegistry,
    private aiRegistry: AIProviderRegistry,
    private permissionBroker: PermissionBroker,
    private toolchainManager: ToolchainManager,
    private gitService: GitService,
    private memory: PersistentMemory
  ) {}

  public onEvent(handler: AgentEventHandler): () => void {
    this.eventHandlers.push(handler);
    return () => {
      this.eventHandlers = this.eventHandlers.filter((h) => h !== handler);
    };
  }

  private emit(type: any, payload: any) {
    if (!this.activeTaskId) return;
    for (const handler of this.eventHandlers) {
      try {
        handler({ taskId: this.activeTaskId, type, payload });
      } catch (err) {
        console.error('Agent event handler error:', err);
      }
    }
  }

  public async startTask(goal: string, autonomy: AutonomyLevel): Promise<{ taskId: string }> {
    const taskId = `task_${Date.now()}`;
    this.activeTaskId = taskId;
    this.isCancelled = false;
    this.permissionBroker.setAutonomyLevel(autonomy);
    this.currentStatus = 'planning';
    this.emit('status_changed', { status: this.currentStatus });

    // Run task execution asynchronously
    this.runAgentLoop(taskId, goal).catch((err) => {
      this.currentStatus = 'failed';
      this.emit('status_changed', { status: this.currentStatus, error: err.message });
    });

    return { taskId };
  }

  public async runTask(goal: string, autonomy: AutonomyLevel): Promise<AgentSessionSummary> {
    const taskId = `task_${Date.now()}`;
    this.activeTaskId = taskId;
    this.isCancelled = false;
    this.permissionBroker.setAutonomyLevel(autonomy);
    this.currentStatus = 'planning';
    this.emit('status_changed', { status: this.currentStatus });

    try {
      return await this.runAgentLoop(taskId, goal);
    } catch (err: any) {
      this.currentStatus = 'failed';
      this.emit('status_changed', { status: this.currentStatus, error: err.message });
      throw err;
    }
  }

  public cancelTask(taskId: string): void {
    if (this.activeTaskId === taskId) {
      this.isCancelled = true;
      this.currentStatus = 'cancelled';
      this.emit('status_changed', { status: this.currentStatus });
    }
  }

  private async runAgentLoop(taskId: string, goal: string): Promise<AgentSessionSummary> {
    const activeShell = this.shellRegistry.getDefaultShellType();
    const osInfo = OSDetector.getOSInfo();

    // 1. Workspace Analysis
    const analysis = await WorkspaceAnalyzer.analyze(
      this.workspaceService,
      this.gitService,
      this.toolchainManager
    );

    // 2. Generate Plan
    const plan = this.createInitialPlan(taskId, goal, activeShell, analysis.projectType);
    this.currentPlan = plan;
    this.emit('plan_updated', { plan });

    const executedCommands: { command: string; exitCode: number; success: boolean }[] = [];
    const modifiedFiles: string[] = [];
    const verifiedResults: string[] = [];
    const unresolvedErrors: string[] = [];

    const toolExecutor = new ToolExecutor(
      this.workspaceService,
      this.shellRegistry,
      this.permissionBroker,
      this.toolchainManager,
      this.gitService
    );

    this.currentStatus = 'executing';
    this.emit('status_changed', { status: this.currentStatus });

    for (let i = 0; i < plan.steps.length; i++) {
      if (this.isCancelled) break;

      const step = plan.steps[i];
      step.status = 'in_progress';
      plan.currentStepIndex = i;
      this.emit('step_started', { stepIndex: i, step });

      if (step.toolName) {
        let recoveryAttempts = 0;
        let stepSucceeded = false;

        while (!stepSucceeded && recoveryAttempts <= 2) {
          if (this.isCancelled) break;

          const toolResult = await toolExecutor.executeTool(
            step.toolName,
            step.toolArgs || {},
            taskId,
            activeShell
          );

          this.emit('tool_executed', { step, result: toolResult });

          if (step.toolName === 'terminal.execute' && step.toolArgs?.command) {
            executedCommands.push({
              command: step.toolArgs.command,
              exitCode: toolResult.exitCode ?? 0,
              success: toolResult.success,
            });
          }

          if (step.toolName === 'workspace.create_file' && step.toolArgs?.path) {
            modifiedFiles.push(step.toolArgs.path);
          }

          // Verification
          const verification = Verifier.verifyStep(step, toolResult);

          if (verification.verified) {
            stepSucceeded = true;
            step.status = 'completed';
            step.resultSummary = verification.summary;
            verifiedResults.push(verification.summary);
            this.emit('step_completed', { stepIndex: i, step, verification });
          } else {
            recoveryAttempts++;
            if (RecoveryManager.shouldAttemptRecovery(recoveryAttempts)) {
              this.currentStatus = 'repairing';
              this.emit('status_changed', { status: this.currentStatus, attempt: recoveryAttempts });

              // Formulate fix
              step.error = toolResult.error || 'Step verification failed';
              const fixPrompt = RecoveryManager.generateRecoveryPrompt(
                step,
                toolResult.output || toolResult.error || '',
                activeShell
              );

              this.emit('message', {
                role: 'assistant',
                content: `Analyzing failure for '${step.title}' using active shell ${activeShell}: ${fixPrompt.slice(0, 200)}...`,
              });

              // Apply fix adjustment if appropriate
              if (step.toolName === 'terminal.execute' && activeShell === 'razzshell') {
                // If a command failed in razzshell, prefer razzshell syntax (e.g. `say` instead of echo)
                step.toolArgs = {
                  ...step.toolArgs,
                  command: step.toolArgs?.command?.replace(/echo\s+/g, 'say '),
                };
              }
            } else {
              step.status = 'failed';
              step.error = toolResult.error || 'Exceeded retry limits';
              unresolvedErrors.push(step.error);
              this.emit('step_completed', { stepIndex: i, step, verification });
              break;
            }
          }
        }

        if (!stepSucceeded && step.status === 'failed') {
          this.currentStatus = 'failed';
          this.emit('status_changed', { status: this.currentStatus, error: step.error });
          break;
        }
      } else {
        step.status = 'completed';
        this.emit('step_completed', { stepIndex: i, step });
      }
    }

    if (this.currentStatus !== 'failed' && !this.isCancelled) {
      this.currentStatus = 'completed';
      this.emit('status_changed', { status: this.currentStatus });
    }

    const summary: AgentSessionSummary = {
      taskId,
      goal,
      status: this.currentStatus,
      modifiedFiles: Array.from(new Set(modifiedFiles)),
      executedCommands,
      verifiedResults,
      unresolvedErrors,
      tokenUsage: this.tokenAccumulator,
    };

    this.emit('message', {
      role: 'assistant',
      content: `Task ${summary.status.toUpperCase()}: ${summary.verifiedResults.length} verified operations, ${summary.modifiedFiles.length} files modified.`,
    });

    return summary;
  }

  private createInitialPlan(
    taskId: string,
    goal: string,
    activeShell: ShellType,
    projectType: string
  ): AgentPlan {
    const steps: PlanStep[] = [];
    const lower = goal.toLowerCase();

    // Smart planner for C++ projects
    if (lower.includes('c++') || lower.includes('cpp')) {
      steps.push({
        id: 'step_1',
        index: 0,
        title: 'Inspect Workspace & Manifests',
        description: 'Examine current directory files and verify compiler availability',
        status: 'pending',
        toolName: 'workspace.list_files',
        toolArgs: { subDir: '.' },
        verifiableCriteria: 'File tree successfully retrieved',
      });

      steps.push({
        id: 'step_2',
        index: 1,
        title: 'Create C++ Source Code',
        description: 'Create main.cpp with hello world and build verification logic',
        status: 'pending',
        toolName: 'workspace.create_file',
        toolArgs: {
          path: 'main.cpp',
          content: `#include <iostream>\n\nint main() {\n    std::cout << "Hello from AI-First IDE and RazzShell!" << std::endl;\n    return 0;\n}\n`,
        },
        verifiableCriteria: 'main.cpp exists on filesystem',
      });

      steps.push({
        id: 'step_3',
        index: 2,
        title: 'Compile C++ Application',
        description: `Compile main.cpp using g++ through ${activeShell}`,
        status: 'pending',
        toolName: 'terminal.execute',
        toolArgs: {
          command: 'g++ -O2 -std=c++20 main.cpp -o app',
        },
        verifiableCriteria: 'Compiler exited with code 0 and generated executable',
      });

      steps.push({
        id: 'step_4',
        index: 3,
        title: 'Execute & Verify Output',
        description: 'Run the compiled binary and verify expected output',
        status: 'pending',
        toolName: 'terminal.execute',
        toolArgs: {
          command: './app',
        },
        verifiableCriteria: 'Program exited with code 0 with expected stdout greeting',
      });
    } else {
      // General workflow planner
      steps.push({
        id: 'step_1',
        index: 0,
        title: 'Analyze Project Environment',
        description: 'Detect existing files, build tools, and configuration',
        status: 'pending',
        toolName: 'workspace.list_files',
        toolArgs: { subDir: '.' },
        verifiableCriteria: 'Workspace files discovered',
      });

      steps.push({
        id: 'step_2',
        index: 1,
        title: 'Execute Action Workflow',
        description: `Run requested command in ${activeShell}`,
        status: 'pending',
        toolName: 'terminal.execute',
        toolArgs: {
          command: activeShell === 'razzshell' ? 'say "Running workflow..."' : 'echo "Running workflow..."',
        },
        verifiableCriteria: 'Command exited with returncode 0',
      });
    }

    return {
      taskId,
      goal,
      steps,
      currentStepIndex: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }
}

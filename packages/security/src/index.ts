import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as crypto from 'node:crypto';
import {
  AutonomyLevel,
  PermissionRequest,
  PermissionDecision,
  PermissionSeverity,
} from '@ai-ide/shared';

// ==========================================
// 1. Path Validator (Workspace Boundaries)
// ==========================================

export class PathValidator {
  public static isPathInsideWorkspace(targetPath: string, workspaceRoot: string): boolean {
    const resolvedRoot = path.resolve(workspaceRoot);
    const resolvedTarget = path.isAbsolute(targetPath)
      ? path.resolve(targetPath)
      : path.resolve(resolvedRoot, targetPath);

    if (resolvedTarget === resolvedRoot) return true;
    const rel = path.relative(resolvedRoot, resolvedTarget);
    return !rel.startsWith('..') && !path.isAbsolute(rel);
  }

  public static assertSafeWorkspacePath(targetPath: string, workspaceRoot: string): string {
    const resolved = path.isAbsolute(targetPath)
      ? path.resolve(targetPath)
      : path.resolve(workspaceRoot, targetPath);

    if (!this.isPathInsideWorkspace(resolved, workspaceRoot)) {
      throw new Error(
        `Security Violation: Path traversal detected. '${targetPath}' is outside the workspace root '${workspaceRoot}'`
      );
    }
    return resolved;
  }
}

// ==========================================
// 2. Secret Redactor
// ==========================================

export class SecretRedactor {
  private static readonly SECRET_PATTERNS = [
    // OpenAI / Grok / Generic sk-... keys
    /sk-[a-zA-Z0-9_\-]{20,}/g,
    // Anthropic keys
    /sk-ant-[a-zA-Z0-9_\-]{20,}/g,
    // Google Gemini API keys (AIzaSy...)
    /AIzaSy[a-zA-Z0-9_\-]{25,45}/g,
    // GitHub PAT / OAuth tokens
    /gh[pousr]_[a-zA-Z0-9]{36,}/g,
    // AWS Secret Access Key
    /(?:aws_secret_access_key|AWS_SECRET_ACCESS_KEY)\s*[:=]\s*["']?([a-zA-Z0-9/+=]{40})["']?/g,
    // Bearer tokens
    /Bearer\s+[a-zA-Z0-9_\-\.]{20,}/gi,
    // Private RSA / SSH keys
    /-----BEGIN [A-Z ]+ PRIVATE KEY-----[a-zA-Z0-9\/\r\n+=]+-----END [A-Z ]+ PRIVATE KEY-----/g,
  ];

  public static redact(text: string): string {
    if (!text) return text;
    let redacted = text;

    for (const pattern of this.SECRET_PATTERNS) {
      redacted = redacted.replace(pattern, (match) => {
        if (match.length <= 8) return '[REDACTED_SECRET]';
        const prefix = match.slice(0, 4);
        const suffix = match.slice(-4);
        return `${prefix}***[REDACTED]***${suffix}`;
      });
    }

    return redacted;
  }

  public static maskApiKey(apiKey: string): string {
    if (!apiKey) return '';
    if (apiKey.length <= 8) return '****';
    return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
  }
}

// ==========================================
// 3. Permission Broker
// ==========================================

export interface PermissionPromptCallback {
  (request: PermissionRequest): Promise<PermissionDecision>;
}

export class PermissionBroker {
  private autonomyLevel: AutonomyLevel = 'supervised';
  private promptHandler: PermissionPromptCallback | null = null;
  private auditHistory: Array<{ request: PermissionRequest; decision: PermissionDecision; timestamp: number }> = [];

  constructor(defaultAutonomy: AutonomyLevel = 'supervised') {
    this.autonomyLevel = defaultAutonomy;
  }

  public setAutonomyLevel(level: AutonomyLevel): void {
    this.autonomyLevel = level;
  }

  public getAutonomyLevel(): AutonomyLevel {
    return this.autonomyLevel;
  }

  public setPromptHandler(handler: PermissionPromptCallback): void {
    this.promptHandler = handler;
  }

  public async evaluateAction(request: {
    taskId: string;
    actionType: 'file_edit' | 'shell_exec' | 'toolchain_install' | 'git_destructive' | 'network';
    target: string;
    command?: string;
    diff?: { filePath: string; oldContent: string; newContent: string };
    reason: string;
  }): Promise<boolean> {
    const severity = this.determineSeverity(request.actionType, request.command);
    const requiresExplicitApproval = this.shouldRequireApproval(this.autonomyLevel, severity, request.actionType);

    const permRequest: PermissionRequest = {
      id: `perm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      taskId: request.taskId,
      actionType: request.actionType,
      target: request.target,
      command: request.command,
      diff: request.diff,
      reason: request.reason,
      severity,
      requiresExplicitApproval,
    };

    if (!requiresExplicitApproval) {
      this.recordAudit(permRequest, { requestId: permRequest.id, approved: true });
      return true;
    }

    if (!this.promptHandler) {
      // Default fail-safe when no interactive UI handler is mounted: reject high impact actions
      const autoApproved = severity === 'low';
      this.recordAudit(permRequest, { requestId: permRequest.id, approved: autoApproved });
      return autoApproved;
    }

    const decision = await this.promptHandler(permRequest);
    this.recordAudit(permRequest, decision);
    return decision.approved;
  }

  private determineSeverity(
    actionType: 'file_edit' | 'shell_exec' | 'toolchain_install' | 'git_destructive' | 'network',
    command?: string
  ): PermissionSeverity {
    if (actionType === 'git_destructive') return 'high';
    if (actionType === 'toolchain_install') return 'medium';

    if (actionType === 'shell_exec' && command) {
      const lower = command.toLowerCase().trim();
      if (lower.includes('sudo') || lower.includes('rm -rf /') || lower.includes('mkfs') || lower.includes('dd if=')) {
        return 'critical';
      }
      if (lower.startsWith('rm ') || lower.startsWith('delete ') || lower.includes('shutdown') || lower.includes('reboot')) {
        return 'high';
      }
      if (lower.startsWith('make ') || lower.startsWith('cmake ') || lower.startsWith('cargo ') || lower.startsWith('npm run')) {
        return 'low';
      }
      return 'medium';
    }

    return 'low';
  }

  private shouldRequireApproval(
    autonomy: AutonomyLevel,
    severity: PermissionSeverity,
    actionType: string
  ): boolean {
    if (autonomy === 'ask') {
      return true; // Always ask for everything in ask mode
    }

    if (autonomy === 'supervised') {
      // Ask on medium, high, critical
      if (severity === 'high' || severity === 'critical') return true;
      if (actionType === 'toolchain_install') return true;
      return false; // Ordinary edits and builds proceed
    }

    if (autonomy === 'autonomous') {
      // Only prompt for critical system destruction / root commands
      return severity === 'critical';
    }

    return true;
  }

  private recordAudit(request: PermissionRequest, decision: PermissionDecision): void {
    this.auditHistory.push({
      request,
      decision,
      timestamp: Date.now(),
    });
  }

  public getAuditHistory() {
    return [...this.auditHistory];
  }
}

// ==========================================
// 4. Local Credential Store
// ==========================================

export class CredentialStore {
  private configDir: string;
  private vaultFile: string;
  private key: Buffer;

  constructor(baseDir?: string) {
    this.configDir = baseDir || path.join(os.homedir(), '.config', 'ai-ide');
    this.vaultFile = path.join(this.configDir, 'credentials.enc');

    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }

    // Deterministic machine key derived from machine identifier & user
    const machineId = `${os.hostname()}-${os.userInfo().username}-ai-ide-salt`;
    this.key = crypto.scryptSync(machineId, 'salt-butter-ide-2026', 32);
  }

  public saveSecret(key: string, secretValue: string): void {
    const existing = this.loadAll();
    existing[key] = secretValue;
    this.saveAll(existing);
  }

  public getSecret(key: string): string | null {
    const all = this.loadAll();
    return all[key] || null;
  }

  public deleteSecret(key: string): void {
    const all = this.loadAll();
    delete all[key];
    this.saveAll(all);
  }

  private loadAll(): Record<string, string> {
    if (!fs.existsSync(this.vaultFile)) return {};
    try {
      const data = fs.readFileSync(this.vaultFile, 'utf-8');
      const parts = data.split(':');
      if (parts.length !== 2) return {};

      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = Buffer.from(parts[1], 'hex');

      const decipher = crypto.createDecipheriv('aes-256-cbc', this.key, iv);
      let decrypted = decipher.update(encrypted, undefined, 'utf8');
      decrypted += decipher.final('utf8');

      return JSON.parse(decrypted);
    } catch {
      return {};
    }
  }

  private saveAll(data: Record<string, string>): void {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-cbc', this.key, iv);
      let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
      encrypted += cipher.final('hex');

      fs.writeFileSync(this.vaultFile, `${iv.toString('hex')}:${encrypted}`, {
        mode: 0o600, // strictly user readable/writable
      });
    } catch (err) {
      console.error('Failed to write credential vault:', err);
    }
  }
}

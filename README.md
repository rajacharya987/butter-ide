# AI-First Desktop IDE with RazzShell

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](#)
[![Tests](https://img.shields.io/badge/tests-22%20passed-brightgreen)](#)
[![Electron](https://img.shields.io/badge/electron-v34.5.8-blue)](#)
[![RazzShell](https://img.shields.io/badge/razzshell-v2.0.0-cyan)](#)
[![License](https://img.shields.io/badge/license-MIT-green)](#)

A production-grade, cross-platform, AI-first Integrated Development Environment (IDE) built with Electron, React, TypeScript, Tailwind CSS, Monaco Editor, and xterm.js.

The IDE places an autonomous coding agent at the center of the development lifecycle, backed by first-class **RazzShell** integration on Linux (specialized for Arch Linux and Ubuntu/Debian), **PowerShell** on Windows, **Zsh** on macOS, a multi-provider AI system, and a one-click **Toolchain Manager** for over 20 programming languages and compilers.

---

## Key Highlights

- ⚡ **First-Class RazzShell Integration**: First-class detection and support for [RazzShell](https://github.com/rajacharya987/razzshell), including cyber prompt visualization, built-in commands (`change`, `list`, `say`, `where`, `howto`), object-based pipelines, and Universal Undo.
- 🤖 **Autonomous AI Coding Agent**: Breaks user goals into verifiable step-by-step plans, writes/edits code, executes commands in the active shell, verifies exit codes, and performs iterative recovery on compilation errors.
- 🌐 **Multi-Provider AI Engine**: Independent provider layer supporting Anthropic Claude, OpenAI, Google Gemini, xAI Grok, and arbitrary local OpenAI-compatible endpoints (Ollama, LM Studio, vLLM).
- 🛠️ **One-Click Toolchain Manager**: Automatically detects and manages 20+ compilers and runtimes (GCC, Clang, Rust, Go, Python, Node.js, TypeScript, .NET, Java, CMake, Ninja, Make, GDB, Deno) with verified platform recipes.
- 💻 **Monaco Code Editor**: Professional tabbed code editing, syntax highlighting, diff viewing, line diagnostics, and shortcuts.
- 📟 **Integrated Terminal**: High-performance xterm.js terminal with true pseudo-terminal (`node-pty`) process streaming and tabbed profiles.
- 🛡️ **Zero-Trust Security**: Path traversal boundaries, Ask/Supervised/Autonomous modes, regex-based secret redaction, and encrypted OS credential storage (`~/.config/ai-ide/credentials.enc`).

---

## Monorepo Architecture

```text
butter/
├── apps/
│   └── desktop/                 # Electron application
│       ├── src/main/            # Trusted main process (Window, PTY, IPC)
│       ├── src/preload/         # Context-isolated typed ideAPI bridge
│       └── src/renderer/        # React 19 + Monaco + xterm.js + Tailwind UI
├── packages/
│   ├── shared/                  # Common TypeScript interfaces and DTOs
│   ├── shell-adapters/          # RazzShell, PowerShell, Bash, Zsh adapters
│   ├── ai-providers/            # Claude, OpenAI, Gemini, Grok, Local AI engine
│   ├── security/                # Permission broker, path traversal, redaction
│   ├── workspace/               # Secure file I/O, recursive tree, search
│   ├── git-integration/         # Git status, diff, branches, commits
│   ├── toolchain-manager/       # Compiler catalog & declarative recipes
│   └── agent-core/              # Autonomous planner, tools, verifier, memory
├── templates/                   # Starter templates (C++, Rust, Go, Python, TS)
├── dist-package/                # Packaged standalone desktop distribution
├── tests/
│   ├── unit/                    # Shell, AI, Security, Toolchain unit tests
│   ├── integration/             # RazzShell execution, agent loop, workspace tests
│   └── e2e/                     # Desktop bundle & packaging tests
└── docs/                        # Architecture, installation, and release notes
```

---

## RazzShell Command Reference

The AI Agent automatically selects native RazzShell commands when RazzShell is active:

| Task | RazzShell Command | POSIX Equivalent |
|------|-------------------|------------------|
| Change Directory | `change [dir]` | `cd [dir]` |
| List Files | `list [-a]` | `ls [-a]` |
| Create File | `create [file]` | `touch [file]` |
| Safe Delete | `delete [file]` | `rm [file]` |
| Universal Undo | `undo` | Reverts last deletion/move |
| Print Directory | `where` | `pwd` |
| Echo Output | `say [text]` | `echo [text]` |
| AI Compiler Diagnostics | `why` / `fix` | Analyzes last compiler failure |
| Command Help | `howto` | `help` |
| Process List | `processes` | `ps` |

---

## Getting Started

### 1. Prerequisites
- Node.js 20+ (Node 26 tested)
- GCC / G++ (for native modules and compilation)
- Arch Linux, Ubuntu/Debian, Fedora, Windows, or macOS

### 2. Installation
```bash
git clone https://github.com/example/ai-ide.git
cd butter
npm install
npm run build
```

### 3. Running Automated Tests
```bash
npm test
```
Runs 22 automated unit, integration, and end-to-end tests covering RazzShell execution, toolchain discovery, security boundaries, and the autonomous agent loop.

### 4. Running the Desktop Application
```bash
npm start
```

### 5. Packaging the Application
```bash
npm run package
```
Creates standalone unpacked binaries in `dist-package/linux-unpacked/`.

---

## License
MIT License.
# butter-ide

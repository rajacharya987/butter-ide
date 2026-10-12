# RazzShell Integration Reference & Architecture

## Overview
RazzShell is a modern Unix shell written in C offering a custom cyber visual prompt, object-based pipelines, self-healing typo correction, built-in AI diagnostics, and Universal Undo. This document details how the AI-First Desktop IDE detects, integrates, and commands RazzShell.

---

## 1. Authoritative Source & Repository
- **Repository**: [https://github.com/rajacharya987/razzshell](https://github.com/rajacharya987/razzshell)
- **Detected Version**: `2.0.0`
- **Source Files**: `razzshell.c`, `src/shell_config.c`, `src/posix_compat.c`, `src/lexer.c`, `src/ast.c`, `src/parser.c`, `src/undo.c`, `src/object_pipeline.c`

---

## 2. Platform Selection & Detection

### Arch Linux (First-Class Native Target)
- **Identification**: `/etc/os-release` (`ID="arch"`, `ID_LIKE="arch"`, or `/etc/arch-release`).
- **Profile Recommendation**: Automatically preselected as default recommended shell profile.
- **Binary Locations**:
  1. `~/.local/bin/razzshell` (preferred user-space build)
  2. `/usr/local/bin/razzshell` (system-wide installation)
  3. `/usr/bin/razzshell` (AUR package binary)
- **Arch Packaging & Build Workflow**:
  - Validated `PKGBUILD` workflow using `base-devel readline ncurses`.
  - Compile command: `gcc razzshell.c src/*.c -o razzshell -lreadline -ldl -lncurses`.

### Ubuntu & Debian
- **Identification**: `/etc/os-release` (`ID="ubuntu"` or `ID="debian"`).
- **Prerequisites**: `build-essential libreadline-dev libncurses5-dev git`.
- **Install Recipe**: Handled via one-click recipe in `ToolchainManager`.

### Windows & macOS
- **Windows**: Defaults to PowerShell 7 (`pwsh.exe`) or Windows PowerShell (`powershell.exe`).
- **macOS**: Defaults to Zsh (`/bin/zsh`).

---

## 3. Supported Built-In Commands Registry

| RazzShell Command | POSIX Equivalent | Description | Category |
|-------------------|------------------|-------------|----------|
| `change` | `cd` | Change current working directory | Navigation |
| `list` | `ls` | Color-coded directory listing with cyber borders | Navigation |
| `where` | `pwd` | Print working directory / filter pipeline output | Navigation |
| `create` | `touch` | Create new empty file | File Ops |
| `delete` | `rm` | Safe deletion (backed by trash journal for undo) | File Ops |
| `copy` | `cp` | Copy file from source to destination | File Ops |
| `move` | `mv` | Move or rename file/folder | File Ops |
| `makedir` | `mkdir` | Create new directory | File Ops |
| `removedir` | `rmdir` | Remove empty directory | File Ops |
| `readfile` | `cat` | Display file contents | File Ops |
| `searchfile` | `find` | Search for file names matching pattern in tree | File Ops |
| `searchtext` | `grep` | Search text inside files | File Ops |
| `say` | `echo` | Display formatted line of text | Utility |
| `undo` | N/A | Revert last reversible filesystem/git operation | File Ops |
| `processes` | `ps` | Structured table of running processes (PID, Name) | Process |
| `terminate` | `kill` | Terminate running process by PID | Process |
| `viewjobs` | `jobs` | List active background jobs | Process |
| `bringtofront` | `fg` | Bring job to foreground | Process |
| `sendtoback` | `bg` | Send job to background | Process |
| `why` | N/A | AI explanation for why last build/command failed | AI Diagnostic |
| `fix` | N/A | Proposes corrected command line with approval | AI Diagnostic |
| `howto` | `help` | Built-in command help and usage syntax | Utility |
| `sysinfo` | `uname -a` | System resource summary with cyber art | System |
| `diskusage` | `df` | Disk storage overview | System |

---

## 4. AI Agent RazzShell Interaction Mode
1. **Shell-Aware Commands**:
   - When RazzShell is active, the agent uses native commands (`say "Building..."` instead of `echo`, `change` instead of `cd`, `list` instead of `ls`).
2. **Path Executable Support**:
   - Fully supports running local project binaries (`./app`, `cmake`, `g++`, `cargo`, `python3`).
3. **Graceful Fallback**:
   - If RazzShell is not installed or encounters an unrecoverable signal, the IDE displays a clear banner offering a one-click build/install, and seamlessly falls back to `/bin/bash` or `/bin/zsh`.

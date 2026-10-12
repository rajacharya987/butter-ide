# Installation & Setup Guide

## System Requirements
- **Linux**: Arch Linux (recommended), Ubuntu 22.04+, Debian 12+, Fedora 39+
- **Windows**: Windows 10/11 with PowerShell 7 or Windows PowerShell 5.1
- **macOS**: macOS 13+ (Ventura or later)
- **Node.js**: v20+ (Node 26 supported)
- **Compilers**: GCC/G++, Clang, or MSVC Build Tools for native development

---

## 1. Quick Start (Development Mode)

```bash
# Clone the workspace
git clone <repository-url>
cd butter

# Install all workspace dependencies
npm install

# Build all monorepo packages
npm run build

# Run automated test suite
npm test

# Launch the desktop IDE in development mode
npm run dev
```

---

## 2. Launching the Desktop Application

To start the full desktop application via Electron:
```bash
npm start
```

---

## 3. First-Run Shell Configuration

When you first launch the IDE:
1. **On Arch Linux**: The IDE detects Arch Linux and recommends **RazzShell v2.0.0**. If missing, click **"Use RazzShell"** on the welcome dialog to compile and configure RazzShell into `~/.local/bin/razzshell`.
2. **On Ubuntu / Debian**: Offers RazzShell with apt package dependencies or native Bash.
3. **On Windows**: Default terminal is automatically set to **PowerShell**.
4. **On macOS**: Default terminal is set to **Zsh**.

---

## 4. Multi-Provider AI Configuration

Navigate to **Settings (gear icon in Activity Bar)**:
1. **Local AI (Ollama / LM Studio)**:
   - Select **Local / Custom Endpoint**.
   - Base URL: `http://localhost:11434/v1` (Ollama) or `http://localhost:1234/v1` (LM Studio).
   - Click **Test AI Connection** to verify zero-latency local inference.
2. **Anthropic Claude**:
   - Enter your `sk-ant-...` API key.
   - Default model: `claude-3-5-sonnet-20241022`.
3. **OpenAI**:
   - Enter your `sk-proj-...` API key.
   - Default model: `gpt-4o`.
4. **Google Gemini**:
   - Enter your `AIzaSy...` API key.
   - Default model: `gemini-2.0-flash`.
5. **xAI Grok**:
   - Enter your `xai-...` API key.
   - Default model: `grok-2-latest`.

All credentials are encrypted and stored in `~/.config/ai-ide/credentials.enc`.

---

## 5. Production Packaging

To build standalone application bundles for distribution:
```bash
npm run package
```
Outputs unpacked bundles and packages into `dist-package/`.

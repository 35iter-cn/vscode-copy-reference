# Paste Image Reference Design

## 2026-05-10

## Overview

Add a new command `copyCodeReference.pasteImage` bound to `Alt+4`. When triggered, the extension reads an image from the system clipboard, saves it to the current runtime environment's temporary directory, and types an `@/path/to/image` reference into the currently focused input (typically Claude Code TUI in the VS Code terminal).

## User Flow

1. User copies an image to the system clipboard (e.g., from a screenshot tool, browser, or image editor).
2. User focuses the TUI input box (e.g., Claude Code in VS Code terminal).
3. User presses `Alt+4`.
4. Extension detects the runtime environment, reads the clipboard image using the appropriate strategy, saves it to a temp file, and types `@/tmp/screenshot-{timestamp}.png` into the focused input.

## Environment Detection & Clipboard Strategy

| Environment | Detection | Read Strategy |
|-------------|-----------|---------------|
| **Local (Windows)** | `os.platform() === 'win32'` | PowerShell `System.Windows.Forms.Clipboard` |
| **Local (macOS)** | `os.platform() === 'darwin'` | `pngpaste` (user must pre-install) |
| **Local (Linux X11)** | `process.env.DISPLAY` exists | `xclip -selection clipboard -t image/{format} -o` |
| **Local (Linux Wayland)** | `process.env.WAYLAND_DISPLAY` exists | `wl-paste` |
| **WSL Remote** | `vscode.env.remoteName === 'wsl'` | Call `powershell.exe` from WSL to read Windows clipboard |
| **SSH Remote** | `vscode.env.remoteName === 'ssh-remote'` | Not supported; show status bar message |

## WSL Remote Detailed Flow (Verified)

The Extension Host runs inside WSL. The Windows clipboard is not directly accessible from WSL, so we leverage WSL's Windows Interop to call PowerShell. The image is transferred as base64 via stdout — no temporary files on Windows, no `/mnt/c/` access:

```
Extension Host (WSL)
  ├─ child_process.spawn('powershell.exe', ['-File', 'read-clipboard.ps1'])
  │     ├─ PowerShell: [System.Windows.Forms.Clipboard]::GetImage()
  │     ├─ PowerShell: Convert to base64 string
  │     └─ PowerShell: Output "OK:<base64>" to stdout
  ├─ stdout.toString('utf8') → "OK:<base64>"
  ├─ Buffer.from(base64, 'base64') → Buffer
  ├─ fs.writeFileSync('/tmp/screenshot-{ts}.png', buffer)
  └─ vscode.commands.executeCommand('type', { text: '@/tmp/...' })
```

**Verification Result**: Successfully read a 132KB PNG from Windows clipboard via `powershell.exe`, transferred as base64 through stdout, decoded to Buffer, and saved to `/tmp/`. File integrity confirmed (132534 bytes in = 132534 bytes out).

### Minimal Implementation (Verified)

```javascript
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

function execPromise(command) {
  return new Promise((resolve, reject) => {
    exec(command, { encoding: 'buffer', maxBuffer: 50 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) reject({ error, stdout, stderr });
      else resolve({ stdout, stderr });
    });
  });
}

async function readClipboardImageFromWSL() {
  const psScript = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
if ([System.Windows.Forms.Clipboard]::ContainsImage()) {
  $img = [System.Windows.Forms.Clipboard]::GetImage()
  $stream = New-Object System.IO.MemoryStream
  $img.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
  $bytes = $stream.ToArray()
  Write-Output "OK:$([Convert]::ToBase64String($bytes))"
} else {
  Write-Output "NO_IMAGE"
}`;

  const psFile = path.join(os.tmpdir(), 'read-clipboard.ps1');
  fs.writeFileSync(psFile, psScript, 'utf8');

  const { stdout } = await execPromise(
    `powershell.exe -ExecutionPolicy Bypass -File "${psFile}"`
  );
  fs.unlinkSync(psFile);

  const result = stdout.toString('utf8').trim();

  if (result === 'NO_IMAGE') {
    throw new Error('No image in clipboard');
  }

  const base64 = result.substring(3); // Strip "OK:" prefix
  const buffer = Buffer.from(base64, 'base64');

  const wslTempFile = path.join(os.tmpdir(), `screenshot-${Date.now()}.png`);
  fs.writeFileSync(wslTempFile, buffer);

  return { buffer, path: wslTempFile };
}
```

## File Naming & Format

- **Filename**: `screenshot-{timestamp}.{ext}`
- **Timestamp Format**: `YYYYMMDDHHmmss` (e.g., `20250510143052`)
- **Format Preservation**: Detect MIME type from clipboard (`image/png`, `image/jpeg`, `image/webp`) and preserve the original extension.
- **Save Location**: `os.tmpdir()`
  - WSL: `/tmp`
  - Windows: `%TEMP%`
  - macOS: `/tmp`
  - Linux: `/tmp`

## Pasting Mechanism

Use `vscode.commands.executeCommand('type', { text: '@/path/to/image.png' })` to simulate keyboard input into the currently focused element. When the terminal (Claude Code TUI) has focus, the text appears directly in the TUI input box.

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Clipboard contains no image | `vscode.window.setStatusBarMessage('No image in clipboard', 3000)` |
| Image read/save failure | Show specific error message in status bar |
| Platform unsupported (SSH Remote) | `vscode.window.setStatusBarMessage('Image paste not supported in SSH remote', 3000)` |
| Missing external tool (e.g., `pngpaste`, `xclip`) | Prompt user to install the required tool |

## Architecture

Refactor from a single-file extension to a modular structure:

```
src/
├── extension.ts          # Register commands, activate/deactivate
├── commands/
│   ├── copyReference.ts  # Existing Alt+3 functionality (extracted from extension.ts)
│   └── pasteImage.ts     # New Alt+4 functionality
└── clipboard/
    ├── index.ts          # Unified entry: detect environment and dispatch
    ├── windows.ts        # Windows & WSL PowerShell implementation
    ├── macos.ts          # macOS pngpaste implementation
    └── linux.ts          # Linux xclip / wl-paste implementation
```

### Module Responsibilities

- **`clipboard/index.ts`**: Detect runtime environment (`Local` vs `WSL` vs `SSH`), validate prerequisites (e.g., `xclip` installed), and delegate to the platform-specific module. Returns `{ buffer: Buffer, mimeType: string }`.
- **`clipboard/windows.ts`**: For both `Local (Windows)` and `WSL Remote`, uses PowerShell to read the clipboard. The only difference is that WSL calls `powershell.exe` (Windows Interop) while Local calls `powershell` directly.
- **`clipboard/macos.ts`**: Spawns `pngpaste` to read clipboard image to a temp file.
- **`clipboard/linux.ts`**: Detects X11 vs Wayland, spawns `xclip` or `wl-paste` accordingly.
- **`commands/pasteImage.ts`**: Orchestrates the full flow: call `clipboard/index.ts`, save to `os.tmpdir()`, format the reference string, execute `type` command.

## Dependencies

No new npm dependencies. The implementation relies on:
- Node.js built-in modules: `child_process`, `fs`, `os`, `path`
- VS Code API: `vscode.commands`, `vscode.window`, `vscode.env`
- External system tools (user must pre-install on some platforms): `pngpaste` (macOS), `xclip` (Linux X11), `wl-clipboard` (Linux Wayland)

## Security Considerations

- PowerShell scripts are executed via `-File` with `-ExecutionPolicy Bypass`. Scripts are generated dynamically and saved to the system's temp directory. No user input is interpolated into the script to prevent injection.
- Image data is transferred as base64 via stdout; no temporary files are created on Windows.
- The `type` command injects text into the focused element. We assume the user intentionally triggered the command via `Alt+4`.

## Open Questions / Future Work

- **SSH Remote Support**: SSH servers typically lack a graphical clipboard. A future enhancement could support servers with X11 forwarding (`$DISPLAY` set), using `xclip` over SSH.
- **Image Compression**: Currently preserves original quality. Could add optional compression/resize for large screenshots.
- **Custom Filename Template**: Allow users to configure the filename pattern via extension settings.

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

The Extension Host runs inside WSL. The Windows clipboard is not directly accessible from WSL, so we leverage WSL's Windows Interop to call PowerShell:

```
Extension Host (WSL)
  ├─ child_process.spawn('powershell.exe', ['-File', 'read-clipboard.ps1'])
  │     ├─ PowerShell: [System.Windows.Forms.Clipboard]::GetImage()
  │     ├─ PowerShell: Save to Windows %TEMP%
  │     └─ PowerShell: Output the Windows file path
  ├─ exec('wslpath -u <windows-path>') → /mnt/c/...
  ├─ fs.readFileSync('/mnt/c/...') → Buffer
  ├─ fs.writeFileSync('/tmp/screenshot-{ts}.png', buffer)
  └─ vscode.commands.executeCommand('type', { text: '@/tmp/...' })
```

**Verification Result**: Successfully read a 131KB PNG from Windows clipboard via `powershell.exe`, transferred it through `/mnt/c/...` to `/tmp/`, and confirmed file integrity.

### Minimal Implementation (Verified)

```javascript
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

function execPromise(command) {
  return new Promise((resolve, reject) => {
    exec(command, { encoding: 'buffer', maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject({ error, stdout, stderr });
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

async function readClipboardImageFromWSL() {
  const psScript = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
if ([System.Windows.Forms.Clipboard]::ContainsImage()) {
  $img = [System.Windows.Forms.Clipboard]::GetImage()
  $tempFile = [System.IO.Path]::GetTempFileName() + ".png"
  $img.Save($tempFile)
  Write-Output "OK:$tempFile"
} else {
  Write-Output "NO_IMAGE"
}
`;

  // Write PowerShell script to a temp file to avoid quoting issues
  const psFile = path.join(os.tmpdir(), 'read-clipboard.ps1');
  fs.writeFileSync(psFile, psScript, 'utf8');

  const { stdout } = await execPromise(
    `powershell.exe -ExecutionPolicy Bypass -File "${psFile}"`
  );
  fs.unlinkSync(psFile);

  // PowerShell output encoding varies; try utf8 first, then fallback
  let result = stdout.toString('utf8').trim();
  if (!result.startsWith('OK:') && result !== 'NO_IMAGE') {
    result = stdout.toString('utf16le').trim();
  }

  if (result === 'NO_IMAGE') {
    throw new Error('No image in clipboard');
  }

  const windowsTempFile = result.substring(3); // Strip "OK:" prefix

  // Convert Windows path to WSL path
  const { stdout: wslPathOut } = await execPromise(`wslpath -u '${windowsTempFile}'`);
  const wslPath = wslPathOut.toString().trim();

  // Read image from Windows filesystem
  const imageBuffer = fs.readFileSync(wslPath);

  // Save to WSL /tmp
  const wslTempFile = path.join(os.tmpdir(), `screenshot-${Date.now()}.png`);
  fs.writeFileSync(wslTempFile, imageBuffer);

  // Clean up Windows temp file
  await execPromise(`powershell.exe -Command "Remove-Item '${windowsTempFile}'"`);

  return { buffer: imageBuffer, path: wslTempFile };
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
- Temporary files in Windows `%TEMP%` are cleaned up immediately after reading.
- The `type` command injects text into the focused element. We assume the user intentionally triggered the command via `Alt+4`.

## Open Questions / Future Work

- **SSH Remote Support**: SSH servers typically lack a graphical clipboard. A future enhancement could support servers with X11 forwarding (`$DISPLAY` set), using `xclip` over SSH.
- **Image Compression**: Currently preserves original quality. Could add optional compression/resize for large screenshots.
- **Custom Filename Template**: Allow users to configure the filename pattern via extension settings.

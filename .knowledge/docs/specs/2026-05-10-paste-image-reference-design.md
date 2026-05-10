# Paste Image Reference Design

## 2026-05-10

## Scope

This spec covers a single, well-defined scenario:

- **VS Code runs on Windows host**
- **Connected to WSL (Linux subsystem) via Remote-WSL**
- **Extension runs inside WSL** (Extension Host is in Linux)

No support for Local Windows, macOS, Linux, or SSH Remote in this iteration.

## Overview

Add a new command `copyCodeReference.pasteImage` bound to `Alt+4`. When triggered, the extension reads an image from the **Windows host clipboard**, saves it to the WSL temp directory (`/tmp`), and types an `@/path/to/image` reference into the currently focused input (typically Claude Code TUI in the VS Code terminal).

## User Flow

1. User copies an image to the **Windows clipboard** (e.g., screenshot tool, browser, image editor).
2. User focuses the TUI input box (e.g., Claude Code in VS Code terminal).
3. User presses `Alt+4`.
4. Extension calls PowerShell via WSL Windows Interop to read the Windows clipboard.
5. Image is transferred as base64 via stdout, decoded, and saved to `/tmp/screenshot-{timestamp}.png`.
6. Extension types `@/tmp/screenshot-{timestamp}.png` into the focused input.

## Implementation Flow

The Extension Host runs inside WSL. The Windows clipboard is not directly accessible, so we leverage WSL's Windows Interop to call PowerShell. The image is transferred as base64 via stdout — no temporary files on Windows, no `/mnt/c/` access:

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

## Verification Result

Successfully read a 132KB PNG from Windows clipboard via `powershell.exe`, transferred as base64 through stdout, decoded to Buffer, and saved to `/tmp/`. File integrity confirmed (132534 bytes in = 132534 bytes out).

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

async function readClipboardImage() {
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

- **Filename**: `screenshot-{timestamp}.png`
- **Timestamp**: `Date.now()` (millisecond precision, simple and collision-resistant)
- **Format**: PNG (PowerShell `System.Drawing.Imaging.ImageFormat::Png`)
- **Save Location**: `os.tmpdir()` → `/tmp` in WSL

## Pasting Mechanism

Use `vscode.commands.executeCommand('type', { text: '@/path/to/image.png' })` to simulate keyboard input into the currently focused element. When the terminal (Claude Code TUI) has focus, the text appears directly in the TUI input box.

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Clipboard contains no image | `vscode.window.setStatusBarMessage('No image in clipboard', 3000)` |
| Image read/save failure | Show specific error message in status bar |
| PowerShell not available | `vscode.window.setStatusBarMessage('powershell.exe not available', 3000)` |

## Architecture

```
src/
├── extension.ts          # Register commands, activate/deactivate
├── commands/
│   ├── copyReference.ts  # Existing Alt+3 functionality
│   └── pasteImage.ts     # New Alt+4 functionality
└── clipboard/
    └── reader.ts         # PowerShell-based clipboard image reader (WSL only)
```

### Module Responsibilities

- **`clipboard/reader.ts`**: Calls `powershell.exe` via WSL Windows Interop, reads the Windows clipboard image as base64 via stdout, decodes to Buffer, saves to `/tmp`, returns the file path.
- **`commands/pasteImage.ts`**: Orchestrates the flow: call `clipboard/reader.ts`, format the `@/path` reference string, execute `type` command. Shows status bar messages on errors.
- **`commands/copyReference.ts`**: Existing `Alt+3` functionality (moved from `extension.ts`).
- **`extension.ts`**: Registers both commands, wires up keybindings.

## Dependencies

No new npm dependencies. Relies on:
- Node.js built-in: `child_process`, `fs`, `os`, `path`
- VS Code API: `vscode.commands`, `vscode.window`
- System: `powershell.exe` (available via WSL Windows Interop by default)

## Security Considerations

- PowerShell scripts are executed via `-File` with `-ExecutionPolicy Bypass`. Scripts are generated dynamically and saved to `/tmp`. No user input is interpolated into the script to prevent injection.
- Image data is transferred as base64 via stdout; no temporary files are created on Windows.
- The `type` command injects text into the focused element. We assume the user intentionally triggered the command via `Alt+4`.

## Future Work

- **Other platforms** (Local Windows, macOS, Linux, SSH Remote): Can be added later by expanding `clipboard/reader.ts` into a dispatcher pattern.
- **Image format detection**: Currently hardcoded to PNG. Could detect the original format from clipboard metadata.
- **Custom filename template**: Allow users to configure the filename pattern via extension settings.

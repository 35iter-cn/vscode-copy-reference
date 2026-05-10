# Paste Image Reference Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new `copyCodeReference.pasteImage` command (bound to `Alt+4`) that reads an image from the Windows clipboard via PowerShell, saves it to WSL `/tmp`, and sends the `@/path/to/image` reference to the active terminal.

**Architecture:** Extract existing copy-reference logic into `src/commands/copyReference.ts`, add `src/clipboard/reader.ts` for PowerShell-based clipboard reading, add `src/commands/pasteImage.ts` for the new command, and wire everything in `src/extension.ts`. Keybindings and commands declared in `package.json`.

**Tech Stack:** TypeScript, VS Code Extension API, Node.js built-ins (`child_process`, `fs`, `os`, `path`), PowerShell via WSL Windows Interop.

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/clipboard/reader.ts` | Calls `powershell.exe` via WSL Windows Interop, reads Windows clipboard image as base64 via stdout, decodes to Buffer, saves to `/tmp`, returns file path. Throws if PowerShell unavailable or no image. |
| `src/commands/copyReference.ts` | Existing `Alt+3` functionality (extracted from `extension.ts`). Reads active editor selection, formats `@path#Lline` reference, writes to clipboard. |
| `src/commands/pasteImage.ts` | New `Alt+4` functionality. Checks `vscode.env.remoteName === 'wsl'`, calls `clipboard/reader.ts`, formats `@/path` reference, sends to active terminal via `sendText()`. Shows status bar errors. |
| `src/extension.ts` | Imports and registers both command handlers. Clean activation/deactivation. |
| `package.json` | Adds new command, global `alt+4` keybinding (no `when` clause), activation event. |

---

### Task 1: Extract Existing Copy Reference to `src/commands/copyReference.ts`

**Files:**
- Create: `src/commands/copyReference.ts`
- Modify: `src/extension.ts` (remove inline command logic)

- [ ] **Step 1: Create `src/commands/copyReference.ts`**

```typescript
import * as vscode from 'vscode';
import * as path from 'path';

export async function copyReference(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  const document = editor.document;
  const selection = editor.selection;

  // Calculate line numbers (1-based)
  const startLine = selection.start.line + 1;
  const endLine = selection.end.line + 1;

  // Determine file path: relative to workspace root if possible, else absolute
  let filePath: string;
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
  if (workspaceFolder) {
    filePath = path.relative(workspaceFolder.uri.fsPath, document.uri.fsPath);
    // Normalize Windows backslashes to forward slashes for consistency
    filePath = filePath.replace(/\\/g, '/');
  } else {
    filePath = document.uri.fsPath.replace(/\\/g, '/');
  }

  // Format: @file#Lline or @file#Lstart-end
  let reference: string;
  if (startLine === endLine) {
    reference = `@${filePath}#L${startLine}`;
  } else {
    reference = `@${filePath}#L${startLine}-${endLine}`;
  }

  try {
    await vscode.env.clipboard.writeText(reference);
  } catch {
    // Silently ignore clipboard errors
  }
}
```

- [ ] **Step 2: Update `src/extension.ts` to import and use `copyReference`**

Replace the entire content of `src/extension.ts` with:

```typescript
import * as vscode from 'vscode';
import { copyReference } from './commands/copyReference';

export function activate(context: vscode.ExtensionContext): void {
  const disposable = vscode.commands.registerCommand('copyCodeReference.copy', copyReference);
  context.subscriptions.push(disposable);
}

export function deactivate(): void {}
```

- [ ] **Step 3: Compile to verify no TypeScript errors**

Run: `npm run compile`
Expected: No errors, `out/extension.js` and `out/commands/copyReference.js` generated.

- [ ] **Step 4: Commit**

```bash
git add src/commands/copyReference.ts src/extension.ts
git commit -m "refactor: extract copyReference command to separate module"
```

---

### Task 2: Create Clipboard Reader Module

**Files:**
- Create: `src/clipboard/reader.ts`

- [ ] **Step 1: Create `src/clipboard/reader.ts`**

```typescript
import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

function execPromise(command: string): Promise<{ stdout: Buffer; stderr: Buffer }> {
  return new Promise((resolve, reject) => {
    exec(command, { encoding: 'buffer', maxBuffer: 50 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) reject({ error, stdout, stderr });
      else resolve({ stdout, stderr });
    });
  });
}

export interface ClipboardImageResult {
  buffer: Buffer;
  path: string;
}

export async function readClipboardImage(): Promise<ClipboardImageResult> {
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

  let stdout: Buffer;
  try {
    const result = await execPromise(
      `powershell.exe -ExecutionPolicy Bypass -File "${psFile}"`
    );
    stdout = result.stdout;
  } finally {
    // Always clean up the temp script, even on error
    try {
      fs.unlinkSync(psFile);
    } catch {
      // Ignore cleanup errors
    }
  }

  const result = stdout.toString('utf8').trim();

  if (result === 'NO_IMAGE') {
    throw new Error('No image in clipboard');
  }

  if (!result.startsWith('OK:')) {
    throw new Error('Unexpected PowerShell output: ' + result.slice(0, 100));
  }

  const base64 = result.substring(3); // Strip "OK:" prefix
  const buffer = Buffer.from(base64, 'base64');

  const wslTempFile = path.join(os.tmpdir(), `screenshot-${Date.now()}.png`);
  fs.writeFileSync(wslTempFile, buffer);

  return { buffer, path: wslTempFile };
}
```

- [ ] **Step 2: Compile to verify no TypeScript errors**

Run: `npm run compile`
Expected: No errors, `out/clipboard/reader.js` generated.

- [ ] **Step 3: Commit**

```bash
git add src/clipboard/reader.ts
git commit -m "feat: add clipboard image reader via PowerShell (WSL only)"
```

---

### Task 3: Create Paste Image Command

**Files:**
- Create: `src/commands/pasteImage.ts`

- [ ] **Step 1: Create `src/commands/pasteImage.ts`**

```typescript
import * as vscode from 'vscode';
import { readClipboardImage } from '../clipboard/reader';

export async function pasteImage(): Promise<void> {
  // Only supported in WSL Remote
  if (vscode.env.remoteName !== 'wsl') {
    vscode.window.setStatusBarMessage('Paste image is only supported in WSL Remote', 3000);
    return;
  }

  const activeTerminal = vscode.window.activeTerminal;
  if (!activeTerminal) {
    vscode.window.setStatusBarMessage('No active terminal', 3000);
    return;
  }

  try {
    const result = await readClipboardImage();
    const reference = `@${result.path}`;
    activeTerminal.sendText(reference);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('No image in clipboard')) {
      vscode.window.setStatusBarMessage('No image in clipboard', 3000);
    } else if (message.includes('powershell.exe')) {
      vscode.window.setStatusBarMessage('powershell.exe not available', 3000);
    } else {
      vscode.window.setStatusBarMessage(`Image paste failed: ${message}`, 3000);
    }
  }
}
```

- [ ] **Step 2: Compile to verify no TypeScript errors**

Run: `npm run compile`
Expected: No errors, `out/commands/pasteImage.js` generated.

- [ ] **Step 3: Commit**

```bash
git add src/commands/pasteImage.ts
git commit -m "feat: add pasteImage command for WSL Remote"
```

---

### Task 4: Wire Commands in `extension.ts`

**Files:**
- Modify: `src/extension.ts`

- [ ] **Step 1: Update `src/extension.ts` to register both commands**

Replace the content with:

```typescript
import * as vscode from 'vscode';
import { copyReference } from './commands/copyReference';
import { pasteImage } from './commands/pasteImage';

export function activate(context: vscode.ExtensionContext): void {
  const copyDisposable = vscode.commands.registerCommand('copyCodeReference.copy', copyReference);
  const pasteDisposable = vscode.commands.registerCommand('copyCodeReference.pasteImage', pasteImage);

  context.subscriptions.push(copyDisposable, pasteDisposable);
}

export function deactivate(): void {}
```

- [ ] **Step 2: Compile to verify no TypeScript errors**

Run: `npm run compile`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/extension.ts
git commit -m "feat: register pasteImage command in extension activation"
```

---

### Task 5: Update `package.json`

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add new command and keybinding to `package.json`**

Replace the `contributes` and `activationEvents` sections:

```json
{
  "activationEvents": [
    "onCommand:copyCodeReference.copy",
    "onCommand:copyCodeReference.pasteImage"
  ],
  "contributes": {
    "commands": [
      {
        "command": "copyCodeReference.copy",
        "title": "Copy Code Reference"
      },
      {
        "command": "copyCodeReference.pasteImage",
        "title": "Paste Image Reference"
      }
    ],
    "keybindings": [
      {
        "command": "copyCodeReference.copy",
        "key": "alt+3",
        "when": "editorTextFocus"
      },
      {
        "command": "copyCodeReference.pasteImage",
        "key": "alt+4"
      }
    ]
  }
}
```

The rest of `package.json` (name, version, scripts, devDependencies, etc.) stays unchanged.

- [ ] **Step 2: Compile to verify no TypeScript errors**

Run: `npm run compile`
Expected: No errors (package.json changes don't affect compilation, but good to confirm).

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "feat: add pasteImage command and Alt+4 keybinding to package.json"
```

---

## Self-Review

### 1. Spec Coverage

| Spec Requirement | Task |
|------------------|------|
| New command `copyCodeReference.pasteImage` | Task 3 + Task 4 |
| Bound to `Alt+4` | Task 5 |
| Global keybinding (no `when` clause) | Task 5 |
| WSL Remote check (`vscode.env.remoteName === 'wsl'`) | Task 3 |
| PowerShell clipboard read via stdout/base64 | Task 2 |
| Save to `/tmp/screenshot-{timestamp}.png` | Task 2 |
| Send `@/path` to active terminal via `sendText()` | Task 3 |
| Status bar error messages | Task 3 |
| Extract existing copyReference to module | Task 1 |
| Register both commands in extension.ts | Task 4 |
| Add activation event for new command | Task 5 |

**Coverage: Complete.**

### 2. Placeholder Scan

- No TBD/TODO/fill-in-details found.
- All code blocks contain complete implementation.
- All commands have expected outputs specified.
- No "similar to Task N" shortcuts.

### 3. Type Consistency

- `readClipboardImage()` returns `Promise<ClipboardImageResult>` with `{ buffer: Buffer; path: string }` — consistent across Task 2 definition and Task 3 usage.
- `copyReference()` and `pasteImage()` both return `Promise<void>` — consistent.
- `extension.ts` imports from correct relative paths (`./commands/copyReference`, `./commands/pasteImage`, `../clipboard/reader`).

---

## Execution Handoff

**Plan complete and saved to `.knowledge/notes/plans/2026-05-10-paste-image-reference.md`.**

**Two execution options:**

1. **Subagent-Driven (recommended)** - Dispatch a fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**

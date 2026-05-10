# Copy Reference to Terminal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modify `copyCodeReference.copy` (Alt+3) so it also sends the `@file#Lline-range` reference to the active terminal when the terminal's foreground process is `claude`.

**Architecture:** Add an `isClaudeTerminal` helper to `copyReference.ts` that inspects the active terminal's PID via `ps -p <pid> -o comm=`. If it matches `'claude'`, call `terminal.sendText(reference, false)` after the clipboard write. All terminal-related failures silently fall back to clipboard-only behavior.

**Tech Stack:** TypeScript, VS Code Extension API (`vscode`), Node.js `child_process`

---

### Task 1: Add process detection and terminal send to copyReference.ts

**Files:**
- Modify: `src/commands/copyReference.ts`

- [ ] **Step 1: Add `child_process` import and `isClaudeTerminal` helper**

  Insert at the top of the file, after the existing imports:

  ```typescript
  import { exec } from 'child_process';

  function execPromise(command: string): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      exec(command, { encoding: 'utf8' }, (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else {
          resolve({ stdout, stderr });
        }
      });
    });
  }

  async function isClaudeTerminal(terminal: vscode.Terminal): Promise<boolean> {
    const pid = await terminal.processId;
    if (!pid) {
      return false;
    }
    try {
      const { stdout } = await execPromise(`ps -p ${pid} -o comm=`);
      const processName = stdout.trim();
      return processName === 'claude';
    } catch {
      return false;
    }
  }
  ```

- [ ] **Step 2: Modify `copyReference` to send to terminal when `claude` is detected**

  Replace the `copyReference` function body (the `try` block at the end) with:

  ```typescript
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

    // Send to active terminal if it's running Claude Code CLI
    const activeTerminal = vscode.window.activeTerminal;
    if (activeTerminal && await isClaudeTerminal(activeTerminal)) {
      activeTerminal.sendText(reference, false);
    }
  }
  ```

- [ ] **Step 3: Compile to verify no TypeScript errors**

  Run: `npm run compile`
  Expected: No errors, `out/commands/copyReference.js` is updated.

- [ ] **Step 4: Commit**

  ```bash
  git add src/commands/copyReference.ts
  git commit -m "feat: send reference to terminal when claude is foreground process"
  ```

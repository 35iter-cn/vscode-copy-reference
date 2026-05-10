import * as vscode from 'vscode';
import * as path from 'path';
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
    // Check the terminal process itself
    const { stdout: selfStdout } = await execPromise(`ps -p ${pid} -o comm=`);
    const selfName = selfStdout.trim();
    if (selfName === 'claude') {
      return true;
    }

    // Check direct child processes
    const { stdout: childrenStdout } = await execPromise(`ps --ppid ${pid} -o comm=`);
    const childNames = childrenStdout.trim().split('\n').map(s => s.trim()).filter(Boolean);
    return childNames.includes('claude');
  } catch {
    return false;
  }
}

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

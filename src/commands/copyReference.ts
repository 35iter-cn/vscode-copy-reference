import * as vscode from 'vscode';
import { exec } from 'child_process';
import * as os from 'os';
import { sendToTerminal } from '../utils/terminal';

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

async function getProcessName(pid: number): Promise<string | null> {
  const platform = os.platform();
  try {
    if (platform === 'win32') {
      const { stdout } = await execPromise(
        `powershell.exe -NoProfile -Command "Get-CimInstance Win32_Process -Filter 'ProcessId=${pid}' | Select-Object -ExpandProperty Name"`
      );
      return stdout.trim().toLowerCase() || null;
    } else {
      // Linux & macOS
      const { stdout } = await execPromise(`ps -p ${pid} -o comm=`);
      return stdout.trim().toLowerCase() || null;
    }
  } catch {
    return null;
  }
}

async function getChildProcessNames(pid: number): Promise<string[]> {
  const platform = os.platform();
  try {
    if (platform === 'win32') {
      const { stdout } = await execPromise(
        `powershell.exe -NoProfile -Command "Get-CimInstance Win32_Process -Filter 'ParentProcessId=${pid}' | Select-Object -ExpandProperty Name"`
      );
      return stdout
        .trim()
        .split('\n')
        .map(s => s.trim().toLowerCase())
        .filter(Boolean);
    } else if (platform === 'darwin') {
      // macOS BSD ps does not support --ppid, use pgrep (available by default)
      const { stdout } = await execPromise(`pgrep -P ${pid} -l`);
      return stdout
        .trim()
        .split('\n')
        .map(line => line.split(/\s+/).slice(1).join(' ').trim().toLowerCase())
        .filter(Boolean);
    } else {
      // Linux (GNU ps)
      const { stdout } = await execPromise(`ps --ppid ${pid} -o comm=`);
      return stdout
        .trim()
        .split('\n')
        .map(s => s.trim().toLowerCase())
        .filter(Boolean);
    }
  } catch {
    return [];
  }
}

async function isClaudeTerminal(terminal: vscode.Terminal): Promise<boolean> {
  const pid = await terminal.processId;
  if (!pid) {
    return false;
  }

  const selfName = await getProcessName(pid);
  if (selfName === 'claude') {
    return true;
  }

  const childNames = await getChildProcessNames(pid);
  return childNames.includes('claude');
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

  // Always use absolute path, normalized to forward slashes
  const filePath = document.uri.fsPath.replace(/\\/g, '/');

  // Format: @file, @file#Lline, or @file#Lstart-end
  let reference: string;
  if (selection.isEmpty) {
    reference = `@${filePath}`;
  } else if (startLine === endLine) {
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
    await sendToTerminal(reference, { appendSpace: true });
  }
}

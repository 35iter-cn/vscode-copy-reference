import * as vscode from 'vscode';
import { isClaudeTerminal } from './terminalDetection';
import { sendToTerminal } from '../utils/terminal';

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

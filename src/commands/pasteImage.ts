import * as vscode from 'vscode';
import { execSync } from 'child_process';
import { readClipboardImage } from '../clipboard/reader';
import { sendToTerminal } from '../utils/terminal';

export async function pasteImage(outputChannel: vscode.OutputChannel): Promise<void> {
  outputChannel.appendLine(`[pasteImage] triggered, remoteName: ${vscode.env.remoteName}, platform: ${process.platform}`);

  const activeTerminal = vscode.window.activeTerminal;
  if (!activeTerminal) {
    vscode.window.setStatusBarMessage('No active terminal', 3000);
    return;
  }

  try {
    const result = await readClipboardImage(outputChannel);
    const reference = `@${result.path}`;
    await sendToTerminal(reference);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('No image in clipboard')) {
      vscode.window.setStatusBarMessage('No image in clipboard', 3000);
      return;
    }

    if (message.includes('Unsupported platform')) {
      vscode.window.setStatusBarMessage('Paste image not supported on this platform', 3000);
      return;
    }

    vscode.window.setStatusBarMessage('Execution failed, see Copy Reference output for details', 3000);
    outputChannel.appendLine(`[pasteImage] Execution failed: ${message}`);
    outputChannel.appendLine(`[pasteImage] Node version: ${process.version}`);
    outputChannel.appendLine(`[pasteImage] Node path: ${process.execPath}`);
    try {
      const psPath = execSync('which powershell.exe 2>/dev/null || echo "NOT_FOUND"', { encoding: 'utf8' }).trim();
      outputChannel.appendLine(`[pasteImage] powershell.exe path: ${psPath}`);
    } catch {
      outputChannel.appendLine(`[pasteImage] powershell.exe path: <unable to resolve>`);
    }
  }
}
